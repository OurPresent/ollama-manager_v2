/**
 * HTTP client for the OpenCode headless server API (opencode serve).
 * See https://opencode.ai/docs/server/ for the API reference.
 */

export interface OpenCodeClientOptions {
  baseUrl: string;
  password?: string;
  timeoutMs?: number;
}

interface OpenCodePart {
  type: string;
  text?: string;
  tool?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  [key: string]: unknown;
}

export interface OpenCodeMessage {
  id: string;
  role: string;
  time?: { created?: number; completed?: number };
  sessionID?: string;
  [key: string]: unknown;
}

export interface OpenCodeMessageResult {
  info: OpenCodeMessage;
  parts: OpenCodePart[];
}

const joinPath = (base: string, path: string): string => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const encode = (value: string): string => encodeURIComponent(value);

export class OpenCodeClient {
  private readonly baseUrl: string;
  private readonly password: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts: OpenCodeClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.password = opts.password || undefined;
    this.timeoutMs = opts.timeoutMs ?? 60000;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (this.password) {
      const token = Buffer.from(`opencode:${this.password}`).toString('base64');
      headers.Authorization = `Basic ${token}`;
    }
    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      const res = await fetch(joinPath(this.baseUrl, path), {
        method,
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenCode API ${res.status}: ${text.slice(0, 500) || path}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  health(): Promise<{ healthy: boolean; version?: string }> {
    return this.request('GET', '/global/health', undefined, 5000);
  }

  project(): Promise<Record<string, unknown>> {
    return this.request('GET', '/project/current');
  }

  configProviders(): Promise<{ providers: Array<Record<string, unknown>>; default: Record<string, string> }> {
    return this.request('GET', '/config/providers');
  }

  providers(): Promise<{ all: Array<Record<string, unknown>>; default: Record<string, string>; connected: string[] }> {
    return this.request('GET', '/provider');
  }

  agents(): Promise<Array<Record<string, unknown>>> {
    return this.request('GET', '/agent');
  }

  commands(): Promise<Array<Record<string, unknown>>> {
    return this.request('GET', '/command');
  }

  listSessions(): Promise<Array<Record<string, unknown>>> {
    return this.request('GET', '/session');
  }

  createSession(title?: string): Promise<Record<string, unknown>> {
    const body = title !== undefined ? { title } : {};
    return this.request('POST', '/session', body);
  }

  getSession(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/session/${encode(id)}`);
  }

  deleteSession(id: string): Promise<boolean> {
    return this.request('DELETE', `/session/${encode(id)}`);
  }

  updateSessionTitle(id: string, title: string): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/session/${encode(id)}`, { title });
  }

  sessionMessages(id: string): Promise<Array<{ info: OpenCodeMessage; parts: OpenCodePart[] }>> {
    return this.request('GET', `/session/${encode(id)}/message`);
  }

  sendMessage(
    id: string,
    body: {
      model?: string;
      agent?: string;
      parts: OpenCodePart[];
    }
  ): Promise<OpenCodeMessageResult> {
    return this.request('POST', `/session/${encode(id)}/message`, body, 10 * 60 * 1000);
  }

  runCommand(
    id: string,
    body: { command: string; arguments?: string; model?: string; agent?: string }
  ): Promise<OpenCodeMessageResult> {
    return this.request('POST', `/session/${encode(id)}/command`, body, 10 * 60 * 1000);
  }

  abort(id: string): Promise<boolean> {
    return this.request('POST', `/session/${encode(id)}/abort`);
  }

  todo(id: string): Promise<Array<Record<string, unknown>>> {
    return this.request('GET', `/session/${encode(id)}/todo`);
  }
}

/** Extracts the concatenated text of an OpenCode message result (text parts). */
export const extractAssistantText = (result: OpenCodeMessageResult): string => {
  const texts: string[] = [];
  for (const part of result.parts ?? []) {
    if (part.type === 'text' && typeof part.text === 'string' && part.text) {
      texts.push(part.text);
    }
  }
  return texts.join('\n');
};

/** Summarizes tool activity (files read/written, bash commands, etc). */
export const extractToolSummaries = (result: OpenCodeMessageResult): Array<{ tool: string; state: string; summary: string }> => {
  const summaries: Array<{ tool: string; state: string; summary: string }> = [];
  for (const part of result.parts ?? []) {
    if (part.type !== 'tool') continue;
    const tool = String(part.tool ?? 'desconocido');
    const state = String(part.state ?? 'output');
    const input = part.input as { path?: string; command?: string; filePath?: string; tool?: string; prompt?: string } | undefined;
    const output = part.output as { filePath?: string; path?: string } | undefined;

    let summary = tool;
    const inputPath = input?.filePath ?? input?.path ?? output?.path ?? output?.filePath;
    if (inputPath) summary += ` → ${String(inputPath)}`;
    else if (input?.command) summary += ` → ${String(input.command).slice(0, 80)}`;

    summaries.push({ tool, state, summary });
  }
  return summaries;
};
