import { create } from 'zustand';
import type { ProjectDto } from '../types/dto';
import {
  fetchProjects,
  fetchActiveProject,
  registerProject,
  activateProject,
} from '../services/systemApi';

interface ProjectsState {
  projects: ProjectDto[];
  activeProject: ProjectDto | null;
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  loadActiveProject: () => Promise<void>;
  register: (payload: { name: string; path: string; description?: string }) => Promise<ProjectDto>;
  activate: (projectId: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  activeProject: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await fetchProjects();
      set({ projects, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar proyectos', loading: false });
    }
  },

  loadActiveProject: async () => {
    try {
      const activeProject = await fetchActiveProject();
      set({ activeProject });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar proyecto activo' });
    }
  },

  register: async (payload) => {
    const project = await registerProject(payload);
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  activate: async (projectId) => {
    await activateProject(projectId);
    const [projects, activeProject] = await Promise.all([fetchProjects(), fetchActiveProject()]);
    set({ projects, activeProject });
  },
}));
