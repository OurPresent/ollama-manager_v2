import { queryAll, queryOne, execute } from './db';
import type { OpenCodeSessionRow, OpenCodeMessageRow, OpenCodeQueryLogRow } from '../core/types';

export const listStoredSessions = async (projectId?: string): Promise<OpenCodeSessionRow[]> => {
  const sql = projectId
    ? `SELECT * FROM opencode_sessions WHERE project_id = ? ORDER BY updated_at DESC`
    : `SELECT * FROM opencode_sessions ORDER BY updated_at DESC`;
  const params = projectId ? [projectId] : [];
  return (await queryAll<OpenCodeSessionRow>(sql, params)) ?? [];
};

export const getStoredSession = async (sessionId: string): Promise<OpenCodeSessionRow | null> => {
  return (await queryOne<OpenCodeSessionRow>('SELECT * FROM opencode_sessions WHERE id = ?', [sessionId])) ?? null;
};

export const upsertStoredSession = async (session: {
  id: string;
  projectId?: string | null;
  title: string;
  agent?: string;
  model?: string;
}): Promise<void> => {
  await execute(
    `INSERT OR REPLACE INTO opencode_sessions (id, project_id, title, agent, model, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [session.id, session.projectId ?? null, session.title, session.agent ?? '', session.model ?? '']
  );
};

export const touchStoredSession = async (sessionId: string, updates?: { agent?: string; model?: string; title?: string }): Promise<void> => {
  const agent = updates?.agent !== undefined ? updates.agent : undefined;
  const model = updates?.model !== undefined ? updates.model : undefined;
  const title = updates?.title !== undefined ? updates.title : undefined;

  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: unknown[] = [];

  if (agent !== undefined) {
    sets.push('agent = ?');
    params.push(agent);
  }
  if (model !== undefined) {
    sets.push('model = ?');
    params.push(model);
  }
  if (title !== undefined) {
    sets.push('title = ?');
    params.push(title);
  }
  params.push(sessionId);

  await execute(`UPDATE opencode_sessions SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const deleteStoredSession = async (sessionId: string): Promise<void> => {
  await execute(`DELETE FROM opencode_sessions WHERE id = ?`, [sessionId]);
};

export const insertStoredMessage = async (message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  model?: string;
  agent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  await execute(
    `INSERT OR REPLACE INTO opencode_messages (id, session_id, role, content, model, agent, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.model ?? '',
      message.agent ?? '',
      JSON.stringify(message.metadata ?? {}),
    ]
  );
};

export const listStoredMessages = async (sessionId: string): Promise<OpenCodeMessageRow[]> => {
  return (
    (await queryAll<OpenCodeMessageRow>(
      `SELECT * FROM opencode_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    )) ?? []
  );
};

export const listOpenCodeQueryLog = async (projectId?: string): Promise<OpenCodeQueryLogRow[]> => {
  return (await queryAll<OpenCodeQueryLogRow>(
    `SELECT
       m.id,
       s.project_id,
       s.title,
       m.content AS raw_query,
       (SELECT m2.content FROM opencode_messages m2
         WHERE m2.session_id = m.session_id AND m2.role = 'assistant' AND m2.created_at >= m.created_at
         ORDER BY m2.created_at ASC LIMIT 1) AS optimized_query,
       m.model,
       m.agent,
       m.created_at
     FROM opencode_messages m
     JOIN opencode_sessions s ON s.id = m.session_id
     WHERE m.role = 'user' AND (? IS NULL OR s.project_id = ?)
     ORDER BY m.created_at DESC`,
    projectId ? [projectId, projectId] : [null, null]
  )) as unknown as OpenCodeQueryLogRow[];
};
