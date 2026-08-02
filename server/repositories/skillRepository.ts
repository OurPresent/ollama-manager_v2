import { queryAll, queryOne, execute } from './db';
import { createId } from '../core/utils';

export type SkillScope = 'project' | 'global';

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  content: string;
  references_json: string;
  scope: SkillScope;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SkillReference {
  path: string;
  content: string;
}

export interface NewSkill {
  name: string;
  description?: string;
  content: string;
  references?: SkillReference[];
  scope?: SkillScope;
  isActive?: boolean;
}

export interface SkillImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; name: string; error: string }>;
  total: number;
}

const parseReferences = (raw: string): SkillReference[] => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((r) => r && typeof r === 'object' && typeof r.path === 'string')
        .map((r) => ({ path: String(r.path), content: r.content != null ? String(r.content) : '' }));
    }
  } catch {
    // ignore
  }
  return [];
};

const mapRow = (row: SkillRow): SkillRow => row;

export const listSkills = async (): Promise<SkillRow[]> => {
  const rows = await queryAll<SkillRow>('SELECT * FROM skills ORDER BY name COLLATE NOCASE ASC');
  return rows.map(mapRow);
};

export const listActiveSkills = async (): Promise<SkillRow[]> => {
  const rows = await queryAll<SkillRow>('SELECT * FROM skills WHERE is_active = 1 ORDER BY name COLLATE NOCASE ASC');
  return rows.map(mapRow);
};

export const getSkillByName = async (name: string): Promise<SkillRow | null> => {
  const row = await queryOne<SkillRow>('SELECT * FROM skills WHERE name = ? LIMIT 1', [name]);
  return row ? mapRow(row) : null;
};

export const getSkillById = async (id: string): Promise<SkillRow | null> => {
  const row = await queryOne<SkillRow>('SELECT * FROM skills WHERE id = ? LIMIT 1', [id]);
  return row ? mapRow(row) : null;
};

export const upsertSkill = async (skill: NewSkill): Promise<{ created: boolean; id: string }> => {
  const existing = await getSkillByName(skill.name);
  const refs = JSON.stringify(skill.references ?? []);
  const scope = skill.scope ?? 'project';
  const isActive = skill.isActive === false ? 0 : 1;

  if (existing) {
    await execute(
      `UPDATE skills
       SET description = ?, content = ?, references_json = ?, scope = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [skill.description ?? '', skill.content, refs, scope, isActive, existing.id]
    );
    return { created: false, id: existing.id };
  }

  const id = createId('skill');
  await execute(
    `INSERT INTO skills (id, name, description, content, references_json, scope, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, skill.name, skill.description ?? '', skill.content, refs, scope, isActive]
  );
  return { created: true, id };
};

export const setSkillActive = async (id: string, active: boolean): Promise<void> => {
  await execute(
    'UPDATE skills SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [active ? 1 : 0, id]
  );
};

export const setSkillScope = async (id: string, scope: SkillScope): Promise<void> => {
  await execute('UPDATE skills SET scope = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scope, id]);
};

export const deleteSkill = async (id: string): Promise<void> => {
  await execute('DELETE FROM skills WHERE id = ?', [id]);
};

export const countSkills = async (): Promise<number> => {
  const row = await queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM skills');
  return Number(row?.c ?? 0);
};

/** Normaliza un item crudo del JSON de import de skills y valida sus headers. */
export const normalizeSkillItem = (
  raw: unknown,
  index: number
): { skill?: NewSkill; error?: string } => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: `[${index}] debe ser un objeto JSON` };
  }
  const obj = raw as Record<string, unknown>;
  const name = String(obj.name ?? obj.Name ?? '').trim();
  const content = String(obj.content ?? obj.instructions ?? obj.prompt ?? obj.Content ?? '').trim();

  if (!name) {
    return { error: `[${index}] falta el header obligatorio "name"` };
  }
  if (!content) {
    return { error: `[${index}] falta el header obligatorio "content" (instrucciones del skill en Markdown)` };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
    return { error: `[${index}] "name" debe ser un slug válido (letras, números y guiones)` };
  }

  let references: SkillReference[] = [];
  if (Array.isArray(obj.references)) {
    references = obj.references
      .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
      .map((r) => {
        const ref = r as Record<string, unknown>;
        return { path: String(ref.path ?? ref.name ?? ''), content: String(ref.content ?? '') };
      })
      .filter((r) => r.path && r.content);
  }

  const scopeRaw = String(obj.scope ?? obj.Scope ?? '').toLowerCase();
  const scope: SkillScope = scopeRaw === 'global' ? 'global' : 'project';

  return {
    skill: {
      name,
      description: obj.description ? String(obj.description) : '',
      content,
      references,
      scope,
      isActive: obj.enabled !== false,
    },
  };
};

/** Importa una lista de skills (JSON array), deduplicando por nombre lowercase. */
export const importSkills = async (items: unknown[]): Promise<SkillImportResult> => {
  const result: SkillImportResult = { imported: 0, updated: 0, skipped: 0, errors: [], total: items.length };
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const { skill, error } = normalizeSkillItem(items[i], i);
    if (error || !skill) {
      result.errors.push({ index: i, name: '', error: error ?? 'item inválido' });
      continue;
    }
    if (seen.has(skill.name.toLowerCase())) {
      result.skipped++;
      continue;
    }
    seen.add(skill.name.toLowerCase());

    const { created } = await upsertSkill(skill);
    if (created) result.imported++;
    else result.updated++;
  }
  return result;
};

export const exportSkills = async (): Promise<Array<Record<string, unknown>>> => {
  const rows = await listSkills();
  return rows.map((s) => ({
    name: s.name,
    description: s.description,
    content: s.content,
    references: parseReferences(s.references_json),
    scope: s.scope,
    enabled: s.is_active === 1,
  }));
};
