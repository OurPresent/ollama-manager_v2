export type OllamaMode = 'docker' | 'local' | 'auto';

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  ollamaUrl: string;
  ollamaMode: 'docker' | 'local';
}

export interface AppSettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  root_path: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  name: string;
  role: string;
  description: string;
  system_prompt: string;
  is_builtin: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AgentDto {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  isBuiltin: boolean;
  status: 'idle' | 'running' | 'completed' | 'error';
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphNodeRow {
  id: string;
  project_name: string;
  node_type: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskLogRow {
  task_id: string;
  project_name: string;
  title: string;
  markdown_content: string;
  tags: string;
  created_at: string;
}

export interface ProjectQueryRow {
  id: number;
  project_name: string;
  title: string;
  raw_query: string;
  optimized_query: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface RunningModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  expires_at: string;
  estimated_size?: number;
}
