import { queryAll, queryOne, execute } from './db';

export interface ChatSessionRow {
  id: string;
  project_id: string | null;
  model_name: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  status: string;
  created_at: string;
}

export const listSessions = async (projectId?: string): Promise<ChatSessionRow[]> => {
  const sql = projectId
    ? `SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC`
    : `SELECT * FROM chat_sessions ORDER BY updated_at DESC`;
  const params = projectId ? [projectId] : [];
  return (await queryAll<ChatSessionRow>(sql, params)) ?? [];
};

export const getSession = async (sessionId: string): Promise<ChatSessionRow | null> => {
  return (await queryOne<ChatSessionRow>('SELECT * FROM chat_sessions WHERE id = ?', [sessionId])) ?? null;
};

export const insertSession = async (session: {
  id: string;
  projectId?: string | null;
  modelName?: string | null;
  title: string;
}): Promise<void> => {
  await execute(
    `INSERT OR REPLACE INTO chat_sessions (id, project_id, model_name, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [session.id, session.projectId ?? null, session.modelName ?? null, session.title]
  );
};

export const updateSessionTitle = async (sessionId: string, title: string): Promise<void> => {
  await execute(`UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    title,
    sessionId,
  ]);
};

export const touchSession = async (sessionId: string): Promise<void> => {
  await execute(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await execute(`DELETE FROM chat_sessions WHERE id = ?`, [sessionId]);
};

export const listMessages = async (sessionId: string): Promise<ChatMessageRow[]> => {
  return (
    (await queryAll<ChatMessageRow>(
      `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    )) ?? []
  );
};

export const insertMessage = async (message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  status?: string;
}): Promise<void> => {
  await execute(
    `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, status, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [message.id, message.sessionId, message.role, message.content, message.status ?? 'completed']
  );
};
