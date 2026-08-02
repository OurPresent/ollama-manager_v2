import { z } from 'zod';

export type Theme = 'dark' | 'light' | 'system';
export type OllamaMode = 'docker' | 'local';

export interface AppSettingsDto {
  theme: Theme;
  ollamaUrl: string;
  ollamaMode: OllamaMode;
}

export const appSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  ollamaUrl: z.string().min(1),
  ollamaMode: z.enum(['docker', 'local']),
});

export interface ProjectDto {
  id: string;
  name: string;
  path: string;
  description: string;
  isActive: boolean;
}

export interface AgentDto {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  isBuiltin: boolean;
  status: 'idle' | 'running' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

export const agentSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  role: z.string().min(1, 'El rol es requerido'),
  systemPrompt: z.string().min(1, 'El system prompt es requerido'),
  description: z.string().optional(),
});

export interface GraphNodeDto {
  id: string;
  projectName: string;
  nodeType: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface TaskLogDto {
  taskId: string;
  projectName: string;
  title: string;
  markdownContent: string;
  tags: string[];
  createdAt: string;
}

export interface ProjectQueryDto {
  id: string;
  projectName: string;
  title: string;
  rawQuery: string;
  optimizedQuery: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

export interface RunningModelDto {
  name: string;
  model: string;
  size: number;
  sizeVram: number;
  expiresAt: string | null;
  contextLength: number | null;
}

export interface OllamaModelDto {
  name: string;
  model: string;
  modifiedAt: string;
  size: number;
  parameterSize: string | null;
  quantizationLevel: string | null;
}

export interface ActionResultDto {
  success: boolean;
  result?: unknown;
  error?: string;
  output?: string;
  running?: boolean;
  mode?: string;
  details?: string;
}
