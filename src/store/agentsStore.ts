import { create } from 'zustand';
import type { PersistedAgent } from '../types';
import { agentSchema } from '../types/dto';
import { fetchAgents, createAgent, updateAgent, deleteAgent } from '../services/systemApi';

interface AgentsState {
  agents: PersistedAgent[];
  loading: boolean;
  error: string | null;
  loadAgents: () => Promise<void>;
  create: (payload: { name: string; role: string; systemPrompt: string; description?: string }) => Promise<void>;
  update: (id: string, payload: { name: string; role: string; systemPrompt: string; description?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  loading: false,
  error: null,

  loadAgents: async () => {
    set({ loading: true, error: null });
    try {
      const agents = await fetchAgents();
      set({ agents, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar agentes', loading: false });
    }
  },

  create: async (payload) => {
    agentSchema.parse(payload);
    await createAgent(payload);
    const agents = await fetchAgents();
    set({ agents });
  },

  update: async (id, payload) => {
    agentSchema.parse(payload);
    await updateAgent(id, payload);
    const agents = await fetchAgents();
    set({ agents });
  },

  remove: async (id) => {
    await deleteAgent(id);
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }));
  },
}));
