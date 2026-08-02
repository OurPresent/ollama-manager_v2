import type { ChatMessage } from '../types';

const BACKEND_URL = '/api';

export interface ChatSessionRecord {
  id: string;
  project_id: string | null;
  model_name: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  status: string;
  created_at: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export const fetchSessions = async (projectId?: string): Promise<ChatSessionRecord[]> => {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${BACKEND_URL}/chat/sessions${query}`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json() as Promise<ChatSessionRecord[]>;
};

export const fetchSessionMessages = async (sessionId: string): Promise<ChatMessageRecord[]> => {
  const res = await fetch(`${BACKEND_URL}/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json() as Promise<ChatMessageRecord[]>;
};

export const saveSession = async (session: {
  id: string;
  projectId?: string | null;
  modelName?: string | null;
  title: string;
}): Promise<void> => {
  await fetch(`${BACKEND_URL}/chat/sessions`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(session),
  });
};

export const saveChatMessage = async (message: ChatMessageRecord): Promise<void> => {
  await fetch(`${BACKEND_URL}/chat/messages`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(message),
  });
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
};

export const toChatMessage = (record: ChatMessageRecord): ChatMessage => ({
  role: record.role === 'tool' ? 'assistant' : record.role,
  content: record.content,
  timestamp: record.created_at,
});
