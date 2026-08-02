import { create } from 'zustand';
import type { AppSettingsDto, RunningModelDto } from '../types/dto';
import { getAppSettings, saveAppSettings } from '../services/systemApi';
import { listModels, getRunningModels, loadOllamaModel, stopOllamaModel } from '../services/ollama';

interface SettingsState {
  settings: AppSettingsDto | null;
  loading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  save: (settings: AppSettingsDto) => Promise<void>;
}

interface OllamaState {
  models: unknown[];
  runningModels: RunningModelDto[];
  loading: boolean;
  error: string | null;
  loadModels: () => Promise<void>;
  loadRunningModels: () => Promise<void>;
  loadModel: (model: string) => Promise<void>;
  stopModel: (model: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await getAppSettings();
      set({ settings, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar configuración', loading: false });
    }
  },

  save: async (settings) => {
    await saveAppSettings(settings);
    set({ settings });
  },
}));

export const useOllamaStore = create<OllamaState>((set) => ({
  models: [],
  runningModels: [],
  loading: false,
  error: null,

  loadModels: async () => {
    set({ loading: true, error: null });
    try {
      const result = await listModels();
      set({ models: Array.isArray(result) ? result : [], loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar modelos', loading: false });
    }
  },

  loadRunningModels: async () => {
    set({ loading: true, error: null });
    try {
      const result = await getRunningModels();
      set({ runningModels: Array.isArray(result) ? result : [], loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar modelos activos', loading: false });
    }
  },

  loadModel: async (model) => {
    await loadOllamaModel(model);
    const result = await getRunningModels();
    set({ runningModels: Array.isArray(result) ? result : [] });
  },

  stopModel: async (model) => {
    await stopOllamaModel(model);
    const result = await getRunningModels();
    set({ runningModels: Array.isArray(result) ? result : [] });
  },
}));
