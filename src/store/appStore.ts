import { create } from 'zustand';
import type { ActiveView } from '../types';

interface AppState {
  activeView: ActiveView;
  theme: 'dark' | 'light' | 'system';
  ollamaMode: 'docker' | 'local';
  ollamaUrl: string;
  setActiveView: (view: ActiveView) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setOllamaMode: (mode: 'docker' | 'local') => void;
  setOllamaUrl: (url: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'home',
  theme: 'dark',
  ollamaMode: 'local',
  ollamaUrl: 'http://localhost:11434',
  setActiveView: (activeView) => set({ activeView }),
  setTheme: (theme) => set({ theme }),
  setOllamaMode: (ollamaMode) => set({ ollamaMode }),
  setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
}));
