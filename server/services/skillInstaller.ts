import fs from 'fs';
import os from 'os';
import path from 'path';
import { getActiveProject } from '../repositories/projectRepository';
import type { SkillReference, SkillRow, SkillScope } from '../repositories/skillRepository';

const globalSkillsDir = (): string => path.join(os.homedir(), '.agents', 'skills');

export const projectSkillsDir = async (): Promise<string> => {
  const project = await getActiveProject();
  if (!project || !project.root_path) {
    throw new Error('No hay un proyecto activo configurado para instalar skills.');
  }
  return path.join(project.root_path, '.opencode', 'skills');
};

export const resolveSkillsDir = async (scope: SkillScope): Promise<string> => {
  return scope === 'global' ? globalSkillsDir() : projectSkillsDir();
};

const sanitizeRelativePath = (name: string, rel: string): string => {
  const safe = rel.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\./g, '');
  if (!safe || safe.includes(':') || safe.startsWith('/')) {
    throw new Error(`Ruta de referencia inválida para el skill "${name}": ${rel}`);
  }
  return safe;
};

const buildSkillDoc = (skill: { name: string; description: string; content: string }): string => {
  const frontmatter = [`---`, `name: ${skill.name}`, `description: ${skill.description || ''}`, `---`].join('\n');
  return `${frontmatter}\n\n${skill.content.trim()}\n`;
};

export interface InstalledSkill {
  name: string;
  scope: SkillScope;
  path: string;
  description: string;
  exists: boolean;
}

/** Lista los skills instalados en disco (por directorio), sin depender de la BD. */
export const listInstalledOnDisk = async (scope?: SkillScope): Promise<InstalledSkill[]> => {
  const scopes: SkillScope[] = scope ? [scope] : ['global', 'project'];
  const results: InstalledSkill[] = [];

  for (const sc of scopes) {
    let dir: string;
    try {
      dir = await resolveSkillsDir(sc);
    } catch {
      continue;
    }
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      const docPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(docPath)) continue;

      let description = '';
      try {
        const raw = fs.readFileSync(docPath, 'utf-8');
        const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (m) {
          const desc = m[1].match(/^description:\s*(.+)$/m);
          if (desc) description = desc[1].trim();
        }
      } catch {
        // ignore
      }

      results.push({
        name: entry.name,
        scope: sc,
        path: skillDir,
        description,
        exists: true,
      });
    }
  }
  return results;
};

export interface InstallResult {
  scope: SkillScope;
  dir: string;
  files: string[];
}

/** Escribe el skill como SKILL.md (+ archivos de referencia) en el directorio del scope. */
export const installSkillToDisk = async (skill: SkillRow): Promise<InstallResult> => {
  const scope = skill.scope === 'global' ? 'global' : 'project';
  const dir = await resolveSkillsDir(scope);
  const skillDir = path.join(dir, skill.name);

  fs.mkdirSync(skillDir, { recursive: true });

  const doc = buildSkillDoc(skill);
  const docPath = path.join(skillDir, 'SKILL.md');
  const tmpDoc = `${docPath}.tmp`;
  fs.writeFileSync(tmpDoc, doc, 'utf-8');
  fs.renameSync(tmpDoc, docPath);

  const files: string[] = ['SKILL.md'];

  let refs: SkillReference[] = [];
  try {
    refs = JSON.parse(skill.references_json ?? '[]');
  } catch {
    refs = [];
  }

  for (const ref of refs) {
    if (!ref.path || !ref.content) continue;
    const rel = sanitizeRelativePath(skill.name, ref.path);
    const target = path.join(skillDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmpTarget = `${target}.tmp`;
    fs.writeFileSync(tmpTarget, ref.content, 'utf-8');
    fs.renameSync(tmpTarget, target);
    files.push(rel);
  }

  return { scope, dir: skillDir, files };
};

/** Elimina el directorio del skill en disco (todos los scopes donde exista). */
export const uninstallSkillFromDisk = async (name: string): Promise<string[]> => {
  const removed: string[] = [];
  for (const scope of ['global', 'project'] as SkillScope[]) {
    let dir: string;
    try {
      dir = await resolveSkillsDir(scope);
    } catch {
      continue;
    }
    const target = path.join(dir, name);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
  }
  return removed;
};

/** Devuelve true si el skill existe en disco en alguno de los scopes. */
export const isSkillOnDisk = async (name: string): Promise<boolean> => {
  const installed = await listInstalledOnDisk();
  return installed.some((s) => s.name === name);
};
