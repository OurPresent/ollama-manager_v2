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

export type ActiveView = 'home' | 'chat' | 'agents' | 'planes' | 'ollama' | 'playground' | 'history' | 'settings';

export interface ProjectInfo {
  name: string;
  path: string;
}
