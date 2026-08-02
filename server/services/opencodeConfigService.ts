import fs from 'fs';
import os from 'os';
import path from 'path';
import { getActiveProject } from '../repositories/projectRepository';

export type ConfigScope = 'project' | 'global';

export interface ConfigFileInfo {
  path: string;
  exists: boolean;
  content: string;
  scope: ConfigScope;
}

const stripJsonComments = (content: string): string => {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += ch;
      }
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === '\\' && next) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
};

const parseConfig = (content: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(stripJsonComments(content));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('El contenido del config debe ser un objeto JSON');
  }
  return parsed as Record<string, unknown>;
};

const globalConfigDir = (): string => path.join(os.homedir(), '.config', 'opencode');

const projectConfigDir = async (): Promise<string> => {
  const project = await getActiveProject();
  if (!project || !project.root_path) {
    throw new Error('No hay un proyecto activo configurado.');
  }
  return project.root_path;
};

const pickExisting = (dir: string): { path: string; isJsonc: boolean } => {
  const candidates = [
    { path: path.join(dir, 'opencode.json'), isJsonc: false },
    { path: path.join(dir, 'opencode.jsonc'), isJsonc: true },
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate.path)) return candidate;
  }
  return candidates[0];
};

export const resolveConfigFile = async (scope: ConfigScope): Promise<{ path: string; isJsonc: boolean }> => {
  if (scope === 'global') {
    return pickExisting(globalConfigDir());
  }
  return pickExisting(await projectConfigDir());
};

export const readConfigFile = async (scope: ConfigScope): Promise<ConfigFileInfo> => {
  const { path: filePath } = await resolveConfigFile(scope);
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, 'utf-8') : '';
  return { path: filePath, exists, content, scope };
};

export const writeConfigFile = async (scope: ConfigScope, content: string): Promise<ConfigFileInfo> => {
  const { path: filePath } = await resolveConfigFile(scope);
  parseConfig(content); // validates
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return { path: filePath, exists: true, content, scope };
};

export interface OllamaProviderConfig {
  ollamaUrl: string;
  models: string[];
  model?: string;
}

export const applyOllamaProvider = async (
  scope: ConfigScope,
  config: OllamaProviderConfig
): Promise<ConfigFileInfo> => {
  const { path: filePath } = await resolveConfigFile(scope);
  const exists = fs.existsSync(filePath);
  let current: Record<string, unknown> = {};
  if (exists) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      current = parseConfig(raw);
    } catch {
      current = {};
    }
  }

  const baseUrl = (config.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const models: Record<string, unknown> = {};
  for (const model of config.models) {
    models[model] = { name: model };
  }

  const providers = (current.provider ?? {}) as Record<string, unknown>;
  providers.ollama = {
    npm: '@ai-sdk/openai-compatible',
    name: 'Ollama (local)',
    options: { baseURL: `${baseUrl}/v1` },
    models,
  };
  current.provider = providers;

  if (config.model) {
    current.model = config.model;
  } else if (config.models.length > 0) {
    current.model = `ollama/${config.models[0]}`;
  }

  const content = `${JSON.stringify(current, null, 2)}\n`;
  await writeConfigFile(scope, content);
  return { path: filePath, exists: true, content, scope };
};

export type PermissionLevel = 'allow' | 'ask' | 'deny';

export interface PermissionsConfig {
  autoApprove: boolean;
  read: PermissionLevel;
  edit: PermissionLevel;
  bash: PermissionLevel;
  webfetch: PermissionLevel;
  websearch: PermissionLevel;
}

const PERMISSION_KEYS: Array<[keyof Omit<PermissionsConfig, 'autoApprove'>, string]> = [
  ['read', 'read'],
  ['edit', 'edit'],
  ['bash', 'bash'],
  ['webfetch', 'webfetch'],
  ['websearch', 'websearch'],
];

export const applyPermissions = async (
  scope: ConfigScope,
  config: PermissionsConfig
): Promise<ConfigFileInfo> => {
  const { path: filePath } = await resolveConfigFile(scope);
  const exists = fs.existsSync(filePath);
  let current: Record<string, unknown> = {};
  if (exists) {
    try {
      current = parseConfig(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      current = {};
    }
  }

  if (config.autoApprove) {
    current.permission = { '*': 'allow' };
  } else {
    const permission: Record<string, string> = {};
    for (const [key] of PERMISSION_KEYS) {
      const level = config[key];
      if (level && level !== 'ask') permission[key] = level;
    }
    current.permission = permission;
  }

  const content = `${JSON.stringify(current, null, 2)}\n`;
  await writeConfigFile(scope, content);
  return { path: filePath, exists: true, content, scope };
};

export const getPermissionsSummary = async (scope: ConfigScope): Promise<PermissionsConfig> => {
  const { path: filePath } = await resolveConfigFile(scope);
  const exists = fs.existsSync(filePath);
  let current: Record<string, unknown> = {};
  if (exists) {
    try {
      current = parseConfig(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      current = {};
    }
  }
  const permission = (current.permission ?? {}) as Record<string, unknown>;
  const pick = (key: string): PermissionLevel => {
    const v = permission[key];
    return v === 'allow' || v === 'deny' ? v : 'ask';
  };
  return {
    autoApprove: Boolean(permission['*']),
    read: pick('read'),
    edit: pick('edit'),
    bash: pick('bash'),
    webfetch: pick('webfetch'),
    websearch: pick('websearch'),
  };
};
