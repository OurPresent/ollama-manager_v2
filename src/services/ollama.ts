import { OllamaModel, ChatMessage } from '../types';
import type { OllamaModelDto, RunningModelDto } from '../types/dto';
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
  } catch (error: unknown) {
    return { running: false, details: error instanceof Error ? error.message : 'Cannot connect to Ollama' };
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
    const settings = await getAppSettings();
    const res = await fetch('/api/docker/ollama/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: settings.ollamaMode }),
    });
    if (!res.ok) throw new Error('Failed to start Ollama');
    return await res.json();
  } catch (error: unknown) {
    throw new Error(`Error starting Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const stopOllama = async (): Promise<{ status: string; message: string; output: string }> => {
  try {
    const settings = await getAppSettings();
    const res = await fetch('/api/docker/ollama/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: settings.ollamaMode }),
    });
    if (!res.ok) throw new Error('Failed to stop Ollama');
    return await res.json();
  } catch (error: unknown) {
    throw new Error(`Error stopping Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const listModels = async (): Promise<OllamaModelDto[]> => {
  try {
    const res = await fetch('/api/ollama/models');
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success) return [];
    const rawModels: Array<Record<string, unknown>> = Array.isArray(data.result) ? data.result : [];
    return rawModels.map((m) => ({
      name: String(m.name ?? ''),
      model: String(m.model ?? ''),
      modifiedAt: String(m.modified_at ?? ''),
      size: Number(m.size ?? 0),
      parameterSize:
        m.details && typeof m.details === 'object'
          ? String((m.details as Record<string, unknown>).parameter_size ?? null)
          : null,
      quantizationLevel:
        m.details && typeof m.details === 'object'
          ? String((m.details as Record<string, unknown>).quantization_level ?? null)
          : null,
    }));
  } catch {
    return [];
  }
};

export const getRunningModels = async (): Promise<RunningModelDto[]> => {
  try {
    const res = await fetch('/api/ollama/running');
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success) return [];
    const rawModels: Array<Record<string, unknown>> = Array.isArray(data.result) ? data.result : [];
    return rawModels.map((m) => ({
      name: String(m.name ?? ''),
      model: String(m.model ?? ''),
      size: Number(m.size ?? 0),
      sizeVram: Number(m.size_vram ?? 0),
      expiresAt: m.expires_at ? String(m.expires_at) : null,
      contextLength: m.context_length != null ? Number(m.context_length) : null,
    }));
  } catch {
    return [];
  }
};

export const loadOllamaModel = async (model: string): Promise<void> => {
  const res = await fetch('/api/ollama/models/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error('Failed to load model');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load model');
};

export const stopOllamaModel = async (model: string): Promise<void> => {
  const res = await fetch('/api/ollama/models/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error('Failed to stop model');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to stop model');
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
