import os from 'os';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { exportDatabase, replaceDatabase } from '../db';

const execFileAsync = promisify(execFile);

const projectRoot = (): string => path.resolve(process.cwd());

const runShell = async (cmd: string): Promise<string> => {
  try {
    const shell = process.platform === 'win32' ? 'cmd' : 'sh';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', cmd] : ['-c', cmd];
    const { stdout } = await execFileAsync(shell, args, { timeout: 30000, windowsHide: true });
    return stdout.trim();
  } catch {
    return '';
  }
};

export interface DeviceInfo {
  platform: string;
  platformVersion: string;
  release: string;
  architecture: string;
  hostname: string;
  cpus: number;
  cpuModel: string;
  totalMem: number;
  freeMem: number;
  uptimeSec: number;
  nodeVersion: string;
  npmVersion: string;
  dockerAvailable: boolean;
  dockerRunning: boolean;
  ollamaInstalled: boolean;
  opencodeInstalled: boolean;
  gitInstalled: boolean;
  backendUrl: string;
  databasePath: string;
}

export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const platform = process.platform;
  const [npmVersion, dockerVersion, dockerRunning, ollamaVersion, opencodeVersion, gitVersion] =
    await Promise.all([
      runShell('npm --version'),
      runShell('docker --version'),
      runShell('docker info --format "{{.ServerVersion}}"'),
      runShell('ollama --version'),
      runShell('opencode --version'),
      runShell('git --version'),
    ]);

  return {
    platform,
    platformVersion: platform === 'win32' ? os.release() : os.type(),
    release: os.release(),
    architecture: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? '',
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    uptimeSec: os.uptime(),
    nodeVersion: process.version,
    npmVersion,
    dockerAvailable: Boolean(dockerVersion),
    dockerRunning: Boolean(dockerRunning),
    ollamaInstalled: Boolean(ollamaVersion),
    opencodeInstalled: Boolean(opencodeVersion),
    gitInstalled: Boolean(gitVersion),
    backendUrl: `http://${os.hostname()}:${process.env.PORT || 3001}`,
    databasePath: path.resolve(projectRoot(), 'server', 'memory.db'),
  };
};

export interface EnvReport {
  checks: Array<{
    name: string;
    installed: boolean;
    version: string;
    status: 'ok' | 'warning' | 'error' | 'info';
    detail: string;
  }>;
  suggestions: string[];
  preparedAt: string;
}

export const prepareEnvironment = async (): Promise<EnvReport> => {
  const info = await getDeviceInfo();
  const [nodeMajor] = info.nodeVersion.replace('v', '').split('.');
  const checks: EnvReport['checks'] = [];
  const suggestions: string[] = [];

  checks.push({
    name: 'Node.js',
    installed: Boolean(info.nodeVersion),
    version: info.nodeVersion || 'no detectado',
    status: Number(nodeMajor) >= 18 ? 'ok' : 'error',
    detail: 'Se requiere Node.js >= 18 para el backend.',
  });
  if (!info.nodeVersion) suggestions.push('Instala Node.js desde https://nodejs.org');

  checks.push({
    name: 'npm',
    installed: Boolean(info.npmVersion),
    version: info.npmVersion || 'no detectado',
    status: info.npmVersion ? 'ok' : 'warning',
    detail: 'npm es el gestor de paquetes.',
  });
  if (!info.npmVersion) suggestions.push('npm se instala junto a Node.js.');

  checks.push({
    name: 'Ollama',
    installed: info.ollamaInstalled,
    version: info.ollamaInstalled ? 'detectado' : 'no detectado',
    status: info.ollamaInstalled ? 'ok' : 'warning',
    detail: 'Necesario para los modelos locales.',
  });
  if (!info.ollamaInstalled) suggestions.push('Instala Ollama desde https://ollama.com');

  checks.push({
    name: 'OpenCode',
    installed: info.opencodeInstalled,
    version: info.opencodeInstalled ? 'detectado' : 'no detectado',
    status: info.opencodeInstalled ? 'ok' : 'warning',
    detail: 'Agente autónomo para el tab OpenCode.',
  });
  if (!info.opencodeInstalled) suggestions.push('Instala OpenCode desde https://opencode.ai');

  checks.push({
    name: 'Docker',
    installed: info.dockerAvailable,
    version: info.dockerAvailable ? 'detectado' : 'no detectado',
    status: info.dockerAvailable ? (info.dockerRunning ? 'ok' : 'warning') : 'info',
    detail: info.dockerAvailable
      ? info.dockerRunning
        ? 'Docker Desktop está corriendo.'
        : 'Docker instalado pero no en ejecución.'
      : 'Opcional: solo se usa para Ollama en contenedor.',
  });

  checks.push({
    name: 'Git',
    installed: info.gitInstalled,
    version: info.gitInstalled ? 'detectado' : 'no detectado',
    status: info.gitInstalled ? 'ok' : 'info',
    detail: 'Opcional: integración con repositorios.',
  });

  checks.push({
    name: 'Dependencias (node_modules)',
    installed: fs.existsSync(path.resolve(projectRoot(), 'node_modules')),
    version: '',
    status: fs.existsSync(path.resolve(projectRoot(), 'node_modules')) ? 'ok' : 'warning',
    detail: 'Ejecuta `npm install` si faltan.',
  });
  if (!fs.existsSync(path.resolve(projectRoot(), 'node_modules'))) {
    suggestions.push('Ejecuta `npm install` en la raíz del proyecto.');
  }

  return { checks, suggestions, preparedAt: new Date().toISOString() };
};

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  databaseBase64: string;
  sizeBytes: number;
}

export const createBackup = async (): Promise<BackupPayload> => {
  const buffer = exportDatabase();
  return {
    app: 'ollama-manager',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    databaseBase64: buffer.toString('base64'),
    sizeBytes: buffer.length,
  };
};

export const restoreBackup = async (payload: BackupPayload): Promise<void> => {
  if (payload.app !== 'ollama-manager') {
    throw new Error('El archivo de respaldo no corresponde a esta aplicación.');
  }
  if (!payload.databaseBase64) {
    throw new Error('El respaldo no contiene datos de base de datos.');
  }
  const buffer = Buffer.from(payload.databaseBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('El respaldo está vacío o es inválido.');
  }
  await replaceDatabase(buffer);
};

export const getDatabasePath = (): string =>
  path.resolve(projectRoot(), 'server', 'memory.db');
