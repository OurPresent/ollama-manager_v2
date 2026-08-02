import { create } from 'zustand';
import type {
  OpenCodeAgent,
  OpenCodeChatMessage,
  OpenCodeCommand,
  OpenCodeProvider,
  OpenCodeSession,
  OpenCodeStatus,
} from '../types';
import {
  abortOpenCodeSession,
  createOpenCodeSession,
  deleteOpenCodeSession,
  getOpenCodeAgents,
  getOpenCodeCommands,
  getOpenCodeProviders,
  getOpenCodeStatus,
  listOpenCodeSessions,
  runOpenCodeCommand,
  sendOpenCodeMessage,
  startOpenCodeServer,
  stopOpenCodeServer,
} from '../services/opencode';

interface OpenCodeState {
  status: OpenCodeStatus | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  sessions: OpenCodeSession[];
  currentSessionId: string | null;
  chatMessages: Record<string, OpenCodeChatMessage[]>;
  providers: OpenCodeProvider[];
  agents: OpenCodeAgent[];
  commands: OpenCodeCommand[];
  defaultModel: string;

  loadStatus: () => Promise<OpenCodeStatus | null>;
  start: (projectPath?: string) => Promise<void>;
  stop: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: (title: string, projectId?: string | null) => Promise<OpenCodeSession | null>;
  selectSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  send: (sessionId: string, content: string, opts: { model?: string; agent?: string; projectId?: string | null; title?: string }) => Promise<void>;
  command: (sessionId: string, command: string, args: string, opts: { model?: string; agent?: string; projectId?: string | null; title?: string }) => Promise<void>;
  abort: (sessionId: string) => Promise<void>;
  setError: (message: string | null) => void;
}

const idSeq = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useOpenCodeStore = create<OpenCodeState>((set, get) => ({
  status: null,
  loading: false,
  sending: false,
  error: null,
  sessions: [],
  currentSessionId: null,
  chatMessages: {},
  providers: [],
  agents: [],
  commands: [],
  defaultModel: '',

  loadStatus: async () => {
    try {
      const status = await getOpenCodeStatus();
      set({ status });
      return status;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo consultar el estado de OpenCode' });
      return null;
    }
  },

  start: async (projectPath) => {
    set({ loading: true, error: null });
    try {
      const status = await startOpenCodeServer(projectPath);
      set({ status });
      await get().loadCatalog();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo iniciar OpenCode' });
    } finally {
      set({ loading: false });
    }
  },

  stop: async () => {
    set({ loading: true, error: null });
    try {
      const status = await stopOpenCodeServer();
      set({ status });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo detener OpenCode' });
    } finally {
      set({ loading: false });
    }
  },

  loadCatalog: async () => {
    if (!get().status?.running) return;
    try {
      const [providersRes, agents, commands] = await Promise.all([
        getOpenCodeProviders(),
        getOpenCodeAgents(),
        getOpenCodeCommands(),
      ]);
      const defaultModel = Object.values(providersRes.default ?? {})[0] ?? '';
      set({ providers: providersRes.providers ?? [], agents, commands, defaultModel });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo cargar el catálogo de OpenCode' });
    }
  },

  loadSessions: async () => {
    if (!get().status?.running) return;
    try {
      const sessions = await listOpenCodeSessions();
      set({ sessions });
      if (sessions.length > 0 && !get().currentSessionId) {
        set({ currentSessionId: sessions[0].id });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudieron cargar las sesiones' });
    }
  },

  createSession: async (title, projectId) => {
    try {
      const session = await createOpenCodeSession(title, projectId);
      set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionId: session.id,
        chatMessages: { ...state.chatMessages, [session.id]: [] },
      }));
      return session;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo crear la sesión' });
      return null;
    }
  },

  selectSession: (sessionId) => {
    set({ currentSessionId: sessionId });
  },

  deleteSession: async (sessionId) => {
    try {
      await deleteOpenCodeSession(sessionId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo eliminar la sesión' });
    }
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      const chatMessages = { ...state.chatMessages };
      delete chatMessages[sessionId];
      return {
        sessions,
        chatMessages,
        currentSessionId: state.currentSessionId === sessionId ? (sessions[0]?.id ?? null) : state.currentSessionId,
      };
    });
  },

  send: async (sessionId, content, opts) => {
    if (!sessionId || get().sending) return;
    set({ sending: true, error: null });
    const userMessage: OpenCodeChatMessage = { id: idSeq('ocmsg'), role: 'user', content };
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [sessionId]: [...(state.chatMessages[sessionId] ?? []), userMessage],
      },
    }));
    try {
      const result = await sendOpenCodeMessage(sessionId, { content, ...opts });
      const assistantMessage: OpenCodeChatMessage = {
        id: result.info.id ?? idSeq('ocmsg'),
        role: 'assistant',
        content: result.assistantText,
        toolSummaries: result.toolSummaries,
      };
      set((state) => ({
        chatMessages: {
          ...state.chatMessages,
          [sessionId]: [...(state.chatMessages[sessionId] ?? []), assistantMessage],
        },
      }));
    } catch (error) {
      set((state) => ({
        chatMessages: {
          ...state.chatMessages,
          [sessionId]: [
            ...(state.chatMessages[sessionId] ?? []),
            { id: idSeq('ocmsg'), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : String(error)}` },
          ],
        },
      }));
    } finally {
      set({ sending: false });
    }
  },

  command: async (sessionId, command, args, opts) => {
    if (!sessionId || get().sending) return;
    set({ sending: true, error: null });
    const prompt = args ? `/${command} ${args}` : `/${command}`;
    const userMessage: OpenCodeChatMessage = { id: idSeq('ocmsg'), role: 'user', content: prompt };
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [sessionId]: [...(state.chatMessages[sessionId] ?? []), userMessage],
      },
    }));
    try {
      const result = await runOpenCodeCommand(sessionId, { command, arguments: args, ...opts });
      const assistantMessage: OpenCodeChatMessage = {
        id: result.info.id ?? idSeq('ocmsg'),
        role: 'assistant',
        content: result.assistantText,
        toolSummaries: result.toolSummaries,
      };
      set((state) => ({
        chatMessages: {
          ...state.chatMessages,
          [sessionId]: [...(state.chatMessages[sessionId] ?? []), assistantMessage],
        },
      }));
    } catch (error) {
      set((state) => ({
        chatMessages: {
          ...state.chatMessages,
          [sessionId]: [
            ...(state.chatMessages[sessionId] ?? []),
            { id: idSeq('ocmsg'), role: 'assistant', content: `Error al ejecutar /${command}: ${error instanceof Error ? error.message : String(error)}` },
          ],
        },
      }));
    } finally {
      set({ sending: false });
    }
  },

  abort: async (sessionId) => {
    try {
      await abortOpenCodeSession(sessionId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo abortar la sesión' });
    }
  },

  setError: (message) => set({ error: message }),
}));
