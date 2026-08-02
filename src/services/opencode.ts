import type {
  OpenCodeAgent,
  OpenCodeCommand,
  OpenCodeConfigFile,
  OpenCodeMessageResult,
  OpenCodeProvider,
  OpenCodeQuery,
  OpenCodeSession,
  OpenCodeSettings,
  OpenCodeStatus,
} from '../types';

const API_BASE = '/api/opencode';

const jsonHeaders = { 'Content-Type': 'application/json' };

const readJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    const message = typeof body?.error === 'string' ? body.error : body?.error ? JSON.stringify(body.error) : `Error ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
};

// ---- Estado / ciclo de vida ----

export const getOpenCodeStatus = async (): Promise<OpenCodeStatus> => {
  const res = await fetch(`${API_BASE}/status`);
  return readJson<OpenCodeStatus>(res);
};

export const startOpenCodeServer = async (projectPath?: string): Promise<OpenCodeStatus> => {
  const res = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ projectPath }),
  });
  return readJson<OpenCodeStatus>(res);
};

export const stopOpenCodeServer = async (): Promise<OpenCodeStatus> => {
  const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
  return readJson<OpenCodeStatus>(res);
};

export const getOpenCodeSettings = async (): Promise<OpenCodeSettings> => {
  const res = await fetch(`${API_BASE}/settings`);
  return readJson<OpenCodeSettings>(res);
};

export const saveOpenCodeSettings = async (settings: OpenCodeSettings): Promise<void> => {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(settings),
  });
  await readJson<{ status: string }>(res);
};

// ---- Datos del servidor ----

export const getOpenCodeProviders = async (): Promise<{ providers: OpenCodeProvider[]; default: Record<string, string> }> => {
  const res = await fetch(`${API_BASE}/config/providers`);
  return readJson<{ providers: OpenCodeProvider[]; default: Record<string, string> }>(res);
};

export const getOpenCodeConnected = async (): Promise<{ all: OpenCodeProvider[]; default: Record<string, string>; connected: string[] }> => {
  const res = await fetch(`${API_BASE}/provider`);
  return readJson<{ all: OpenCodeProvider[]; default: Record<string, string>; connected: string[] }>(res);
};

export const getOpenCodeAgents = async (): Promise<OpenCodeAgent[]> => {
  const res = await fetch(`${API_BASE}/agents`);
  return readJson<OpenCodeAgent[]>(res);
};

export const getOpenCodeCommands = async (): Promise<OpenCodeCommand[]> => {
  const res = await fetch(`${API_BASE}/commands`);
  return readJson<OpenCodeCommand[]>(res);
};

// ---- Sesiones ----

export const listOpenCodeSessions = async (): Promise<OpenCodeSession[]> => {
  const res = await fetch(`${API_BASE}/sessions`);
  return readJson<OpenCodeSession[]>(res);
};

export const createOpenCodeSession = async (title?: string, projectId?: string | null): Promise<OpenCodeSession> => {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ title, projectId }),
  });
  return readJson<OpenCodeSession>(res);
};

export const deleteOpenCodeSession = async (sessionId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  await readJson<{ status: string }>(res);
};

export const fetchOpenCodeMessages = async (sessionId: string): Promise<Array<{ info: OpenCodeSession; parts: OpenCodePartLike[] }>> => {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`);
  return readJson<Array<{ info: OpenCodeSession; parts: OpenCodePartLike[] }>>(res);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenCodePartLike = Record<string, any>;

export const sendOpenCodeMessage = async (
  sessionId: string,
  body: { content: string; model?: string; agent?: string; projectId?: string | null; title?: string }
): Promise<OpenCodeMessageResult> => {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return readJson<OpenCodeMessageResult>(res);
};

export const runOpenCodeCommand = async (
  sessionId: string,
  body: { command: string; arguments?: string; model?: string; agent?: string; projectId?: string | null; title?: string }
): Promise<OpenCodeMessageResult> => {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/command`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  return readJson<OpenCodeMessageResult>(res);
};

export const abortOpenCodeSession = async (sessionId: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/abort`, { method: 'POST' });
  return readJson<boolean>(res);
};

// ---- Configuración ----

export const readOpenCodeConfigFile = async (scope: 'project' | 'global'): Promise<OpenCodeConfigFile> => {
  const res = await fetch(`${API_BASE}/config-file?scope=${scope}`);
  return readJson<OpenCodeConfigFile>(res);
};

export const writeOpenCodeConfigFile = async (scope: 'project' | 'global', content: string): Promise<OpenCodeConfigFile> => {
  const res = await fetch(`${API_BASE}/config-file`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ scope, content }),
  });
  return readJson<OpenCodeConfigFile>(res);
};

export const applyOllamaToOpenCode = async (
  scope: 'project' | 'global',
  config: { ollamaUrl?: string; models: string[]; model?: string }
): Promise<OpenCodeConfigFile> => {
  const res = await fetch(`${API_BASE}/config-file/ollama`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ scope, ...config }),
  });
  return readJson<OpenCodeConfigFile>(res);
};

// ---- Permisos / auto-aprobaciones ----

export interface OpenCodePermissions {
  autoApprove: boolean;
  read: 'allow' | 'ask' | 'deny';
  edit: 'allow' | 'ask' | 'deny';
  bash: 'allow' | 'ask' | 'deny';
  webfetch: 'allow' | 'ask' | 'deny';
  websearch: 'allow' | 'ask' | 'deny';
}

export const getOpenCodePermissions = async (scope: 'project' | 'global'): Promise<OpenCodePermissions> => {
  const res = await fetch(`${API_BASE}/config/permissions?scope=${scope}`);
  return readJson<OpenCodePermissions>(res);
};

export const saveOpenCodePermissions = async (
  scope: 'project' | 'global',
  perms: OpenCodePermissions
): Promise<OpenCodeConfigFile> => {
  const res = await fetch(`${API_BASE}/config/permissions`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ scope, ...perms }),
  });
  return readJson<OpenCodeConfigFile>(res);
};

// ---- Historial persistido ----

export const listOpenCodeQueries = async (projectId?: string): Promise<OpenCodeQuery[]> => {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${API_BASE}/queries${qs}`);
  const rows = await readJson<Array<Record<string, unknown>>>(res);
  return rows.map((q) => ({
    id: String(q.id ?? ''),
    projectId: q.project_id ? String(q.project_id) : null,
    title: String(q.title ?? ''),
    rawQuery: String(q.raw_query ?? ''),
    optimizedQuery: q.optimized_query != null ? String(q.optimized_query) : null,
    model: String(q.model ?? ''),
    agent: String(q.agent ?? ''),
    createdAt: String(q.created_at ?? ''),
  }));
};
