import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { ProjectRow } from '../core/types';
import { upsertIndexedFile, clearProjectFiles, countProjectFiles } from '../repositories/fileIndexRepository';
import { writeAuditEvent } from '../core/audit';
import { clearContextBlocks, upsertContextBlock, insertSnapshot } from '../repositories/contextRepository';

const DEFAULT_IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'coverage',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.exe',
  '.dll',
  '.dylib',
  '.so',
  '.bin',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
  '.lock',
  '.class',
  '.jar',
]);

export const isFileIndexable = (fileName: string): boolean => {
  if (DEFAULT_IGNORED.has(fileName)) return false;
  const ext = path.extname(fileName).toLowerCase();
  return !IGNORED_EXTENSIONS.has(ext);
};

const computeFileHash = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  return new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

export const indexProject = async (project: ProjectRow): Promise<number> => {
  const root = project.root_path;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Project root does not exist: ${root}`);
  }

  const walk = (dir: string): string[] => {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (DEFAULT_IGNORED.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walk(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IGNORED_EXTENSIONS.has(ext)) continue;
        results.push(fullPath);
      }
    }
    return results;
  };

  const files = walk(root);
  await clearProjectFiles(project.id);

  let totalSizeBytes = 0;
  const filesByDir = new Map<string, number>();
  const filesByType = new Map<string, number>();

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) continue;
      totalSizeBytes += stat.size;

      const relativePath = path.relative(root, filePath).split(path.sep).join('/');
      const dirName = path.dirname(relativePath);
      filesByDir.set(dirName, (filesByDir.get(dirName) ?? 0) + 1);

      const fileType = path.extname(filePath).replace('.', '').toLowerCase() || 'txt';
      filesByType.set(fileType, (filesByType.get(fileType) ?? 0) + 1);

      const hash = await computeFileHash(filePath);
      await upsertIndexedFile({
        projectId: project.id,
        relativePath,
        fileType,
        sizeBytes: stat.size,
        modifiedAt: new Date(stat.mtimeMs).toISOString(),
        hash,
      });
    } catch (error) {
      console.error(`Error indexing ${filePath}:`, error);
    }
  }

  const total = await countProjectFiles(project.id);
  await generateProjectContext(project, {
    fileCount: total,
    totalSizeBytes,
    filesByDir,
    filesByType,
  });
  await writeAuditEvent('files.indexed', 'project', project.id, project.id, {
    files: total,
    rootPath: root,
  });
  return total;
};

const generateProjectContext = async (
  project: ProjectRow,
  stats: {
    fileCount: number;
    totalSizeBytes: number;
    filesByDir: Map<string, number>;
    filesByType: Map<string, number>;
  }
): Promise<void> => {
  await clearContextBlocks(project.id);

  const sortedDirs = Array.from(stats.filesByDir.entries()).sort((a, b) => b[1] - a[1]);
  const treeLines = sortedDirs.map(([dir, count]) => `${dir}: ${count} archivo(s)`);
  const tree = treeLines.join('\n') || '(sin archivos)';

  const sortedTypes = Array.from(stats.filesByType.entries()).sort((a, b) => b[1] - a[1]);
  const byType = sortedTypes.map(([type, count]) => `${type || 'sin-extension'}: ${count}`).join(', ');

  const summary = [
    `Proyecto: ${project.name}`,
    `Ruta: ${project.root_path}`,
    `Archivos indexados: ${stats.fileCount}`,
    `Tamaño total: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`,
    ``,
    `Distribución por tipo: ${byType || 'n/a'}`,
  ].join('\n');

  await upsertContextBlock({
    projectId: project.id,
    blockType: 'tree',
    title: 'Estructura de directorios (archivos indexados)',
    content: tree,
  });
  await upsertContextBlock({
    projectId: project.id,
    blockType: 'summary',
    title: 'Resumen estructural del proyecto',
    content: summary,
  });
  await upsertContextBlock({
    projectId: project.id,
    blockType: 'stats',
    title: 'Estadísticas',
    content: JSON.stringify(
      {
        fileCount: stats.fileCount,
        totalSizeBytes: stats.totalSizeBytes,
        filesByType: Object.fromEntries(stats.filesByType),
        filesByDir: Object.fromEntries(stats.filesByDir),
      },
      null,
      2
    ),
  });

  await insertSnapshot({
    projectId: project.id,
    fileCount: stats.fileCount,
    totalSizeBytes: stats.totalSizeBytes,
    snapshot: {
      filesByType: Object.fromEntries(stats.filesByType),
      filesByDir: Object.fromEntries(stats.filesByDir),
      indexedAt: new Date().toISOString(),
    },
  });
};
