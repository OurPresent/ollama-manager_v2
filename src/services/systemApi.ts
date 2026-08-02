import { PersistedAgent, BulkImportResult } from '../types';
import type { ModelUsageDto, ProjectDto, SystemStatsDto } from '../types/dto';

const API_BASE = '/api';

type ProjectRow = {
  id: string;
  name: string;
  root_path: string;
  description: string | null;
  is_active: number;
};

const mapProjectRow = (project: ProjectRow): ProjectDto => ({
  id: project.id,
  name: project.name,
  path: project.root_path,
  description: project.description || '',
  isActive: Boolean(project.is_active),
});

export type Theme = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: Theme;
  ollamaUrl: string;
  ollamaMode: 'docker' | 'local';
}

export const getAppSettings = async (): Promise<AppSettings> => {
  const res = await fetch(`${API_BASE}/settings/app`);
  if (!res.ok) {
    throw new Error('No se pudo cargar la configuración');
  }
  const settings = (await res.json()) as AppSettings;
  localStorage.setItem('theme', settings.theme || 'dark');
  return settings;
};

export const saveAppSettings = async (settings: AppSettings): Promise<void> => {
  const res = await fetch(`${API_BASE}/settings/app`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar la configuración');
  }

  localStorage.setItem('theme', settings.theme);
};

export const fetchProjects = async (): Promise<ProjectDto[]> => {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los proyectos');
  }

  const projects = (await res.json()) as ProjectRow[];
  return projects.map(mapProjectRow);
};

export const fetchActiveProject = async (): Promise<ProjectDto | null> => {
  const res = await fetch(`${API_BASE}/projects/active`);
  if (!res.ok) {
    throw new Error('No se pudo cargar el proyecto activo');
  }

  const project = (await res.json()) as ProjectRow | null;
  if (!project) return null;

  return mapProjectRow(project);
};

export const registerProject = async (payload: {
  name: string;
  path: string;
  description?: string;
}): Promise<ProjectDto> => {
  const res = await fetch(`${API_BASE}/projects/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      rootPath: payload.path,
      description: payload.description || '',
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'No se pudo registrar el proyecto' }));
    throw new Error(error.error || 'No se pudo registrar el proyecto');
  }

  const data = await res.json();
  return mapProjectRow(data.project as ProjectRow);
};

export const activateProject = async (projectId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/activate`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('No se pudo activar el proyecto');
  }
};

export const fetchAgents = async (): Promise<PersistedAgent[]> => {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los agentes');
  }
  return res.json();
};

export const fetchAllAgents = async (): Promise<PersistedAgent[]> => {
  const res = await fetch(`${API_BASE}/agents/all`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los agentes');
  }
  return res.json();
};

export const setAgentActive = async (id: string, active: boolean): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) {
    throw new Error('No se pudo cambiar el estado del agente');
  }
};

export const fetchSystemStats = async (): Promise<SystemStatsDto | null> => {
  try {
    const res = await fetch(`${API_BASE}/system/stats`);
    if (!res.ok) return null;
    return (await res.json()) as SystemStatsDto;
  } catch {
    return null;
  }
};

export const fetchModelUsage = async (): Promise<ModelUsageDto[]> => {
  try {
    const res = await fetch(`${API_BASE}/system/model-usage`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export type AgentPayload = Omit<PersistedAgent, 'id' | 'status' | 'lastExecution' | 'description'> & {
  description?: string;
};

export const createAgent = async (payload: AgentPayload): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('No se pudo crear el agente');
  }
};

export const updateAgent = async (
  id: string,
  payload: AgentPayload
): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('No se pudo actualizar el agente');
  }
};

export const deleteAgent = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('No se pudo eliminar el agente');
  }
};

// ---------------------------------------------------------------------------
// Importación masiva de agentes (JSON)
// ---------------------------------------------------------------------------

export const importAgentsBulk = async (items: unknown[]): Promise<BulkImportResult> => {
  const res = await fetch(`${API_BASE}/agents/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudieron importar los agentes');
  }
  return (await res.json()) as BulkImportResult;
};

export const fetchAgentsImportTemplate = async (): Promise<{ items: string; headers: string[] }> => {
  const res = await fetch(`${API_BASE}/agents/import/template`);
  if (!res.ok) throw new Error('No se pudo obtener el formato de agentes');
  const data = (await res.json()) as { items: string; headers: string[] };
  return { items: data.items ?? '', headers: data.headers ?? [] };
};

export const validateAgentsBulk = async (
  items: unknown[]
): Promise<{ valid: number; errors: Array<{ index: number; name: string; error: string }>; total: number }> => {
  const res = await fetch(`${API_BASE}/agents/import/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('No se pudo validar el JSON de agentes');
  return (await res.json()) as { valid: number; errors: Array<{ index: number; name: string; error: string }>; total: number };
};

export const exportAgentsBulk = async (): Promise<Record<string, unknown>[]> => {
  const res = await fetch(`${API_BASE}/agents/export`);
  if (!res.ok) throw new Error('No se pudo exportar los agentes');
  const data = (await res.json()) as { items: Record<string, unknown>[] };
  return data.items ?? [];
};

// ---------------------------------------------------------------------------
// Dispositivo y respaldos
// ---------------------------------------------------------------------------

export interface DeviceInfo {
  platform: string;
  platformVersion: string;
  release: string;
  architecture: string;
  hostname: string;
  cpus: number;
  cpuModel: string;
  totalMem: number;
  freeMem: number;
  uptimeSec: number;
  nodeVersion: string;
  npmVersion: string;
  dockerAvailable: boolean;
  dockerRunning: boolean;
  ollamaInstalled: boolean;
  opencodeInstalled: boolean;
  gitInstalled: boolean;
  backendUrl: string;
  databasePath: string;
}

export interface EnvReport {
  checks: Array<{
    name: string;
    installed: boolean;
    version: string;
    status: 'ok' | 'warning' | 'error' | 'info';
    detail: string;
  }>;
  suggestions: string[];
  preparedAt: string;
}

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  databaseBase64: string;
  sizeBytes: number;
}

export const fetchDeviceInfo = async (): Promise<DeviceInfo> => {
  const res = await fetch(`${API_BASE}/device/info`);
  if (!res.ok) throw new Error('No se pudo obtener la información del dispositivo');
  return (await res.json()) as DeviceInfo;
};

export const prepareEnvironment = async (): Promise<EnvReport> => {
  const res = await fetch(`${API_BASE}/device/prepare`, { method: 'POST' });
  if (!res.ok) throw new Error('No se pudo analizar el entorno');
  return (await res.json()) as EnvReport;
};

export const createBackup = async (): Promise<BackupPayload> => {
  const res = await fetch(`${API_BASE}/device/backup`);
  if (!res.ok) throw new Error('No se pudo crear el respaldo');
  return (await res.json()) as BackupPayload;
};

export const restoreBackup = async (payload: BackupPayload): Promise<void> => {
  const res = await fetch(`${API_BASE}/device/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo restaurar el respaldo');
  }
};
