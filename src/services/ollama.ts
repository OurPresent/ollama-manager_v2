import { OllamaModel, ChatMessage } from '../types';
import { getAppSettings } from './systemApi';

let cachedOllamaBaseUrl: string | null = null;

export const setCachedOllamaBaseUrl = (url: string) => {
  cachedOllamaBaseUrl = url;
};

export const getOllamaBaseUrl = async (): Promise<string> => {
  if (cachedOllamaBaseUrl) {
    return cachedOllamaBaseUrl;
  }

  try {
    const settings = await getAppSettings();
    cachedOllamaBaseUrl = settings.ollamaUrl || import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
  } catch {
    cachedOllamaBaseUrl = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
  }

  return cachedOllamaBaseUrl;
};

export const checkOllamaStatus = async (): Promise<{ running: boolean; details: string }> => {
  try {
    const baseUrl = await getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    if (res.ok) {
      return { running: true, details: 'Ollama is running' };
    }
    return { running: false, details: 'Ollama is not responding' };
  } catch (error: any) {
    return { running: false, details: error.message || 'Cannot connect to Ollama' };
  }
};

export const fetchInstalledModels = async (): Promise<OllamaModel[]> => {
  try {
    const baseUrl = await getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
};

export const startOllama = async (): Promise<{ status: string; message: string; output: string }> => {
  try {
    const res = await fetch('/api/docker/ollama/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to start Ollama');
    return await res.json();
  } catch (error: any) {
    throw new Error(`Error starting Ollama: ${error.message}`);
  }
};

export const stopOllama = async (): Promise<{ status: string; message: string; output: string }> => {
  try {
    const res = await fetch('/api/docker/ollama/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to stop Ollama');
    return await res.json();
  } catch (error: any) {
    throw new Error(`Error stopping Ollama: ${error.message}`);
  }
};

export const deleteModel = async (modelName: string): Promise<boolean> => {
  try {
    const baseUrl = await getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const pullModelStream = async (
  modelName: string,
  onProgress: (status: string, progressPct: number) => void
): Promise<boolean> => {
  try {
    const baseUrl = await getOllamaBaseUrl();
    const res = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const status = parsed.status || '';
          const total = parsed.total || 0;
          const completed = parsed.completed || 0;
          const pct = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
          onProgress(status, pct);
        } catch {}
      }
    }
    return true;
  } catch {
    return false;
  }
};

export const streamChatCompletion = async (
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<string> => {
  const baseUrl = await getOllamaBaseUrl();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) throw new Error('Error al conectar con Ollama');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const content = parsed.message?.content || '';
        fullText += content;
        onChunk(content);
      } catch {}
    }
  }

  return fullText;
};
