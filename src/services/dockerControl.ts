const API_BASE = 'http://localhost:8502/api';

export interface DockerStatus {
  running: boolean;
  details: string;
}

export const checkDockerOllamaStatus = async (): Promise<DockerStatus> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/status`);
    return await res.json();
  } catch {
    return { running: false, details: 'Error connecting to server' };
  }
};

export const startOllamaDocker = async (): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/start`, { method: 'POST' });
    return await res.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to start Ollama');
  }
};

export const stopOllamaDocker = async (): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${API_BASE}/docker/ollama/stop`, { method: 'POST' });
    return await res.json();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to stop Ollama');
  }
};