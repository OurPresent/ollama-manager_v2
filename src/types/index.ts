export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface GraphNode {
  id: string;
  projectName: string;
  nodeType: 'ENTIDAD' | 'COMPONENTE' | 'SERVICIO' | 'MODULO';
  title: string;
  content: string;
  updatedAt: string;
}

export interface TaskLog {
  taskId: string;
  projectName: string;
  title: string;
  markdownContent: string;
  tags: string[];
  createdAt: string;
}

export interface AgentRole {
  id: string;
  name: string;
  systemPrompt: string;
  icon: string;
}

export type ActiveView = 'home' | 'chat' | 'agents' | 'planes' | 'ollama' | 'opencode' | 'playground' | 'history' | 'settings';

export interface ProjectInfo {
  id?: string;
  name: string;
  path: string;
  description?: string;
}

export interface PersistedAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  description: string;
  model?: string;
  isBuiltin?: boolean;
  isActive?: boolean;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastExecution?: string;
}

export interface OpenCodeStatus {
  running: boolean;
  external: boolean;
  managed: boolean;
  pid?: number;
  port: number;
  hostname: string;
  version?: string;
  healthy?: boolean;
  error?: string;
  logTail?: string[];
}

export interface OpenCodeSettings {
  port: number;
  hostname: string;
  password: string;
  autoStart: boolean;
}

export interface OpenCodeProviderModel {
  id: string;
  name?: string;
  limit?: { context?: number; output?: number };
}

export interface OpenCodeProvider {
  id: string;
  name: string;
  npm?: string;
  models?: OpenCodeProviderModel[] | Record<string, OpenCodeProviderModel>;
  defaultModel?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OpenCodeAgent {
  id: string;
  name?: string;
  description?: string;
  model?: string;
  tools?: Record<string, boolean | unknown>;
  primary?: boolean;
  [key: string]: unknown;
}

export interface OpenCodeCommand {
  name: string;
  title?: string;
  description?: string;
  agent?: string;
  model?: string;
  template?: string;
  [key: string]: unknown;
}

export interface OpenCodeSessionModelRef {
  id?: string;
  providerID?: string;
  variant?: string;
}

export interface OpenCodeSession {
  id: string;
  title?: string;
  agent?: string;
  model?: string | OpenCodeSessionModelRef;
  parentID?: string | null;
  time?: { created?: number; updated?: number };
  projectID?: string;
  version?: number;
  [key: string]: unknown;
}

export interface OpenCodePart {
  type: string;
  text?: string;
  tool?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  [key: string]: unknown;
}

export interface OpenCodeToolSummary {
  tool: string;
  state: string;
  summary: string;
}

export interface OpenCodeMessageResult {
  info: { id: string; role: string; time?: { created?: number; completed?: number } } & Record<string, unknown>;
  parts: OpenCodePart[];
  assistantText: string;
  toolSummaries: OpenCodeToolSummary[];
}

export interface OpenCodeChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolSummaries?: OpenCodeToolSummary[];
  created_at?: string;
}

export interface OpenCodeConfigFile {
  path: string;
  exists: boolean;
  content: string;
  scope: 'project' | 'global';
}

export interface OpenCodeQuery {
  id: string;
  projectId: string | null;
  title: string;
  rawQuery: string;
  optimizedQuery: string | null;
  model: string;
  agent: string;
  createdAt: string;
}
