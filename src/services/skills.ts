import { BulkImportResult, InstalledSkill, PersistedSkill } from '../types';

const API_BASE = '/api/skills';

export const fetchSkills = async (): Promise<PersistedSkill[]> => {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('No se pudieron cargar los skills');
  return (await res.json()) as PersistedSkill[];
};

export const fetchSkillsInstalled = async (): Promise<InstalledSkill[]> => {
  const res = await fetch(`${API_BASE}/installed`);
  if (!res.ok) throw new Error('No se pudieron listar los skills instalados');
  return (await res.json()) as InstalledSkill[];
};

export const fetchSkillsTemplate = async (): Promise<{ items: string; headers: string[] }> => {
  const res = await fetch(`${API_BASE}/template`);
  if (!res.ok) throw new Error('No se pudo obtener el formato de skills');
  const data = (await res.json()) as { items: string; headers: string[] };
  return { items: data.items ?? '', headers: data.headers ?? [] };
};

export const importSkillsBulk = async (items: unknown[]): Promise<BulkImportResult> => {
  const res = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudieron importar los skills');
  }
  return (await res.json()) as BulkImportResult;
};

export const validateSkillsBulk = async (
  items: unknown[]
): Promise<{ valid: number; errors: Array<{ index: number; name: string; error: string }>; total: number }> => {
  const res = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('No se pudo validar el JSON de skills');
  return (await res.json()) as { valid: number; errors: Array<{ index: number; name: string; error: string }>; total: number };
};

export const exportSkillsBulk = async (): Promise<Record<string, unknown>[]> => {
  const res = await fetch(`${API_BASE}/export`);
  if (!res.ok) throw new Error('No se pudo exportar los skills');
  const data = (await res.json()) as { items: Record<string, unknown>[] };
  return data.items ?? [];
};

export const installSkill = async (id: string, scope?: 'project' | 'global'): Promise<void> => {
  const res = await fetch(`${API_BASE}/${id}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo instalar el skill');
  }
};

export const uninstallSkill = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/${id}/uninstall`, { method: 'POST' });
  if (!res.ok) throw new Error('No se pudo desinstalar el skill');
};

export const toggleSkill = async (id: string, active: boolean): Promise<void> => {
  const res = await fetch(`${API_BASE}/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error('No se pudo actualizar el skill');
};

export const deleteSkill = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('No se pudo eliminar el skill');
};
