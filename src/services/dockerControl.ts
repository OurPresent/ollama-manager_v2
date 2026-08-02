const API_BASE = '/api';

export interface DockerStatus {
  running: boolean;
  details: string;
  mode?: 'docker' | 'local' | 'unknown';
}

export interface DockerInfo {
  docker_installed: boolean;
  docker_running: boolean;
  docker_version?: string;
  server_version?: string;
  containers: Array<{
    name: string;
    status: string;
    image: string;
    ports: string;
  }>;
  ollama_container: {
    name: string;
    status: string;
    image: string;
    ports: string;
  } | null;
}

export const checkDockerOllamaStatus = async (): Promise<DockerStatus> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/status`);
    return await res.json();
  } catch {
    return { running: false, details: 'Error connecting to server', mode: 'unknown' };
  }
};

export const startOllamaDocker = async (): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/start`, { method: 'POST' });
    return await res.json();
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to start Ollama');
  }
};

export const stopOllamaDocker = async (): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/stop`, { method: 'POST' });
    return await res.json();
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to stop Ollama');
  }
};

export const restartOllamaDocker = async (): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/restart`, { method: 'POST' });
    return await res.json();
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to restart Ollama');
  }
};

export const getDockerInfo = async (): Promise<DockerInfo> => {
  try {
    const res = await fetch(`${API_BASE}/docker/info`);
    const data = await res.json();
    return data.result || data;
  } catch {
    return {
      docker_installed: false,
      docker_running: false,
      containers: [],
      ollama_container: null
    };
  }
};
