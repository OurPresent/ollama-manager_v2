import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { ProjectRow } from '../core/types';
import { upsertIndexedFile, clearProjectFiles, countProjectFiles } from '../repositories/fileIndexRepository';
import { writeAuditEvent } from '../core/audit';

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

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) continue;

      const relativePath = path.relative(root, filePath).split(path.sep).join('/');
      const hash = await computeFileHash(filePath);
      await upsertIndexedFile({
        projectId: project.id,
        relativePath,
        fileType: path.extname(filePath).replace('.', '').toLowerCase(),
        sizeBytes: stat.size,
        modifiedAt: new Date(stat.mtimeMs).toISOString(),
        hash,
      });
    } catch (error) {
      console.error(`Error indexing ${filePath}:`, error);
    }
  }

  const total = await countProjectFiles(project.id);
  await writeAuditEvent('files.indexed', 'project', project.id, project.id, {
    files: total,
    rootPath: root,
  });
  return total;
};
