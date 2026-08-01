import { PersistedAgent, ProjectInfo } from '../types';

const API_BASE = '/api';

export type Theme = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: Theme;
  ollamaUrl: string;
  ollamaMode: 'docker' | 'local';
}

export const getAppSettings = async (): Promise<AppSettings> => {
  const res = await fetch(`${API_BASE}/settings/app`);
  if (!res.ok) {
    throw new Error('No se pudo cargar la configuración');
  }
  return res.json();
};

export const saveAppSettings = async (settings: AppSettings): Promise<void> => {
  const res = await fetch(`${API_BASE}/settings/app`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar la configuración');
  }
};

export const fetchProjects = async (): Promise<ProjectInfo[]> => {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los proyectos');
  }

  const projects = await res.json();
  return projects.map((project: any) => ({
    id: project.id,
    name: project.name,
    path: project.root_path,
    description: project.description || '',
  }));
};

export const fetchActiveProject = async (): Promise<ProjectInfo | null> => {
  const res = await fetch(`${API_BASE}/projects/active`);
  if (!res.ok) {
    throw new Error('No se pudo cargar el proyecto activo');
  }

  const project = await res.json();
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    path: project.root_path,
    description: project.description || '',
  };
};

export const registerProject = async (payload: {
  name: string;
  path: string;
  description?: string;
}): Promise<ProjectInfo> => {
  const res = await fetch(`${API_BASE}/projects/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      rootPath: payload.path,
      description: payload.description || '',
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'No se pudo registrar el proyecto' }));
    throw new Error(error.error || 'No se pudo registrar el proyecto');
  }

  const data = await res.json();
  return {
    id: data.project.id,
    name: data.project.name,
    path: data.project.root_path,
    description: data.project.description || '',
  };
};

export const activateProject = async (projectId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/activate`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('No se pudo activar el proyecto');
  }
};

export const fetchAgents = async (): Promise<PersistedAgent[]> => {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) {
    throw new Error('No se pudieron cargar los agentes');
  }
  return res.json();
};

export const createAgent = async (payload: Omit<PersistedAgent, 'id' | 'status'>): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('No se pudo crear el agente');
  }
};

export const updateAgent = async (
  id: string,
  payload: Omit<PersistedAgent, 'id' | 'status'>
): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('No se pudo actualizar el agente');
  }
};

export const deleteAgent = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('No se pudo eliminar el agente');
  }
};
