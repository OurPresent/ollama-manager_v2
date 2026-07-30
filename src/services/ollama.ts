import { OllamaModel, ChatMessage } from '../types';

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

export const checkOllamaStatus = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
};

export const fetchInstalledModels = async (): Promise<OllamaModel[]> => {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
};

export const deleteModel = async (modelName: string): Promise<boolean> => {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
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
    const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
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
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
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