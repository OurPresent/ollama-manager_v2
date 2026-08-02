import type { GraphNodeDto, TaskLogDto, ProjectQueryDto } from '../types/dto';

const BACKEND_URL = '/api';

const jsonHeaders = { 'Content-Type': 'application/json' };

const readJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const fetchGraphNodes = async (projectName: string): Promise<GraphNodeDto[]> => {
  const res = await fetch(`${BACKEND_URL}/graph/${encodeURIComponent(projectName)}`);
  const nodes = await readJson<Array<Record<string, unknown>>>(res);
  return nodes.map((n) => ({
    id: String(n.id ?? ''),
    projectName: String(n.project_name ?? ''),
    nodeType: String(n.node_type ?? ''),
    title: String(n.title ?? ''),
    content: String(n.content ?? ''),
    updatedAt: String(n.updated_at ?? ''),
  }));
};

export const saveGraphNodeToSqlite = async (node: GraphNodeDto): Promise<void> => {
  await fetch(`${BACKEND_URL}/graph`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      id: node.id,
      project_name: node.projectName,
      node_type: node.nodeType,
      title: node.title,
      content: node.content,
    }),
  });
};

export const fetchTaskLogs = async (projectName: string): Promise<TaskLogDto[]> => {
  const res = await fetch(`${BACKEND_URL}/logs/${encodeURIComponent(projectName)}`);
  const logs = await readJson<Array<Record<string, unknown>>>(res);
  return logs.map((l) => ({
    taskId: String(l.task_id ?? ''),
    projectName: String(l.project_name ?? ''),
    title: String(l.title ?? ''),
    markdownContent: String(l.markdown_content ?? ''),
    tags: Array.isArray(l.tags) ? (l.tags as string[]) : [],
    createdAt: String(l.created_at ?? ''),
  }));
};

export const saveTaskLogToSqlite = async (log: TaskLogDto): Promise<void> => {
  await fetch(`${BACKEND_URL}/logs`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      task_id: log.taskId,
      project_name: log.projectName,
      title: log.title,
      markdown_content: log.markdownContent,
      tags: log.tags,
    }),
  });
};

export interface ProjectFileEntry {
  relativePath: string;
  fileType: string;
  sizeBytes: number;
  modifiedAt: string | null;
}

export const fetchProjectFiles = async (
  projectId: string,
  query = ''
): Promise<ProjectFileEntry[]> => {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  const res = await fetch(`${BACKEND_URL}/projects/${encodeURIComponent(projectId)}/files${qs}`);
  const data = await readJson<{ files: Array<Record<string, unknown>> }>(res);
  return (data.files ?? []).map((f) => ({
    relativePath: String(f.relative_path ?? ''),
    fileType: String(f.file_type ?? ''),
    sizeBytes: Number(f.size_bytes ?? 0),
    modifiedAt: f.modified_at ? String(f.modified_at) : null,
  }));
};

export const fetchFileContent = async (
  projectId: string,
  path: string
): Promise<{ path: string; content: string }> => {
  const res = await fetch(
    `${BACKEND_URL}/projects/${encodeURIComponent(projectId)}/files/content?path=${encodeURIComponent(path)}`
  );
  return readJson<{ path: string; content: string }>(res);
};

export const indexProjectFiles = async (projectId: string): Promise<number> => {
  const res = await fetch(`${BACKEND_URL}/projects/${encodeURIComponent(projectId)}/index`, {
    method: 'POST',
  });
  const data = await readJson<{ status: string; indexedFiles: number }>(res);
  return data.indexedFiles;
};

export interface AuditEventDto {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export const fetchAuditEvents = async (projectId?: string, limit = 50): Promise<AuditEventDto[]> => {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (projectId) qs.set('projectId', projectId);
  const res = await fetch(`${BACKEND_URL}/audit/events?${qs.toString()}`);
  const rows = await readJson<Array<Record<string, unknown>>>(res);
  return rows.map((a) => ({
    id: String(a.id ?? ''),
    eventType: String(a.event_type ?? ''),
    entityType: String(a.entity_type ?? ''),
    entityId: String(a.entity_id ?? ''),
    projectId: a.project_id ? String(a.project_id) : null,
    details: (a.details_json ? JSON.parse(String(a.details_json)) : {}) as Record<string, unknown>,
    createdAt: String(a.created_at ?? ''),
  }));
};

export interface SystemLogDto {
  id: string;
  level: string;
  source: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export const fetchSystemLogs = async (limit = 50): Promise<SystemLogDto[]> => {
  const res = await fetch(`${BACKEND_URL}/audit/logs?limit=${limit}`);
  const rows = await readJson<Array<Record<string, unknown>>>(res);
  return rows.map((l) => ({
    id: String(l.id ?? ''),
    level: String(l.level ?? ''),
    source: String(l.source ?? ''),
    message: String(l.message ?? ''),
    details: (l.details_json ? JSON.parse(String(l.details_json)) : {}) as Record<string, unknown>,
    createdAt: String(l.created_at ?? ''),
  }));
};

export const fetchProjectQueries = async (projectName: string): Promise<ProjectQueryDto[]> => {
  const res = await fetch(`${BACKEND_URL}/queries/${encodeURIComponent(projectName)}`);
  const queries = await readJson<Array<Record<string, unknown>>>(res);
  return queries.map((q) => ({
    id: String(q.id ?? ''),
    projectName: String(q.project_name ?? ''),
    title: String(q.title ?? ''),
    rawQuery: String(q.raw_query ?? ''),
    optimizedQuery: q.optimized_query != null ? String(q.optimized_query) : null,
    executionTimeMs: q.execution_time_ms != null ? Number(q.execution_time_ms) : null,
    createdAt: String(q.created_at ?? ''),
  }));
};

export const saveProjectQuery = async (query: {
  projectName: string;
  title: string;
  rawQuery: string;
  optimizedQuery?: string | null;
  executionTimeMs?: number | null;
}): Promise<void> => {
  await fetch(`${BACKEND_URL}/queries`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      project_name: query.projectName,
      title: query.title,
      raw_query: query.rawQuery,
      optimized_query: query.optimizedQuery ?? null,
      execution_time_ms: query.executionTimeMs ?? null,
    }),
  });
};
