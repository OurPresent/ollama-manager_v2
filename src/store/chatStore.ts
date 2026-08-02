import { create } from 'zustand';
import type { ChatMessage } from '../types';
import {
  fetchSessions,
  fetchSessionMessages,
  saveSession,
  saveChatMessage,
  deleteChatSession,
  toChatMessage,
} from '../services/chatDb';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  messagesBySession: Record<string, ChatMessage[]>;
  currentSessionId: string | null;
  loading: boolean;
  error: string | null;
  loadSessions: (projectId?: string) => Promise<void>;
  createSession: (title: string, projectId?: string | null, modelName?: string | null) => Promise<ChatSession | null>;
  switchSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  persistMessage: (sessionId: string, message: ChatMessage, messageId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  messagesBySession: {},
  currentSessionId: null,
  loading: false,
  error: null,

  loadSessions: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const records = await fetchSessions(projectId);
      const sessions: ChatSession[] = records.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.created_at,
      }));
      set({ sessions, loading: false });
      if (records.length > 0 && !get().currentSessionId) {
        await get().switchSession(records[0].id);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar sesiones', loading: false });
    }
  },

  createSession: async (title, projectId, modelName) => {
    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveSession({ id, projectId, modelName, title });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al crear sesión' });
    }
    const session: ChatSession = { id, title, createdAt: new Date().toISOString() };
    set((state) => ({
      sessions: [session, ...state.sessions],
      messagesBySession: { ...state.messagesBySession, [id]: [] },
      currentSessionId: id,
    }));
    return session;
  },

  switchSession: async (sessionId) => {
    const messages = get().messagesBySession[sessionId];
    if (!messages) {
      try {
        const records = await fetchSessionMessages(sessionId);
        const loaded = records.map(toChatMessage);
        set((state) => ({
          messagesBySession: { ...state.messagesBySession, [sessionId]: loaded },
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Error al cargar mensajes' });
      }
    }
    set({ currentSessionId: sessionId });
  },

  removeSession: async (sessionId) => {
    try {
      await deleteChatSession(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      const messagesBySession = { ...state.messagesBySession };
      delete messagesBySession[sessionId];
      return {
        sessions,
        messagesBySession,
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
      };
    });
  },

  setMessages: (sessionId, messages) => {
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    }));
  },

  persistMessage: async (sessionId, message, messageId) => {
    try {
      await saveChatMessage({
        id: messageId,
        session_id: sessionId,
        role: message.role === 'user' || message.role === 'assistant' ? message.role : 'assistant',
        content: message.content,
        status: 'completed',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error persisting message:', error);
    }
  },
}));
