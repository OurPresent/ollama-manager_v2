import { spawn, type ChildProcess, type ChildProcessByStdio } from 'child_process';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import { queryAll, execute } from '../repositories/db';
import { OpenCodeClient } from './opencodeClient';
import type { OpenCodeSettings } from '../core/types';

const LOG_LIMIT = 300;
const logTail: string[] = [];

let managedChild: ChildProcess | null = null;

const appendLog = (line: string): void => {
  const clean = line.replace(/\r?\n$/, '');
  if (!clean) return;
  logTail.push(clean);
  if (logTail.length > LOG_LIMIT) logTail.shift();
};

export const getOpenCodeLogTail = (): string[] => [...logTail];

const getSetting = async (key: string, fallback: string): Promise<string> => {
  const rows = (await queryAll('SELECT value FROM app_settings WHERE key = ?', [key])) as unknown as Array<{ value: string }>;
  const raw = rows[0]?.value;
  return raw !== undefined && raw !== null && raw !== '' ? String(raw) : fallback;
};

export const getOpenCodeSettings = async (): Promise<OpenCodeSettings> => {
  const port = Number.parseInt(await getSetting('opencode_port', '4096'), 10);
  const hostname = await getSetting('opencode_hostname', '127.0.0.1');
  const password = await getSetting('opencode_password', '');
  const autoStart = (await getSetting('opencode_auto_start', '0')) === '1';
  return {
    port: Number.isFinite(port) && port > 0 ? port : 4096,
    hostname: hostname || '127.0.0.1',
    password,
    autoStart,
  };
};

export const saveOpenCodeSettings = async (settings: OpenCodeSettings): Promise<void> => {
  const port = Number.isFinite(settings.port) && settings.port > 0 ? settings.port : 4096;
  const updates: Array<[string, string]> = [
    ['opencode_port', String(port)],
    ['opencode_hostname', settings.hostname || '127.0.0.1'],
    ['opencode_password', settings.password ?? ''],
    ['opencode_auto_start', settings.autoStart ? '1' : '0'],
  ];
  for (const [key, value] of updates) {
    await execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }
};

export const getOpenCodeBaseUrl = async (): Promise<string> => {
  const settings = await getOpenCodeSettings();
  return `http://${settings.hostname}:${settings.port}`;
};

export const getOpenCodeClient = async (timeoutMs = 60000): Promise<OpenCodeClient> => {
  const settings = await getOpenCodeSettings();
  return new OpenCodeClient({
    baseUrl: `http://${settings.hostname}:${settings.port}`,
    password: settings.password || undefined,
    timeoutMs,
  });
};

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
}

export const isOpenCodeRunning = async (): Promise<{ running: boolean; version?: string; external: boolean; error?: string }> => {
  try {
    const client = await getOpenCodeClient(4000);
    const health = await client.health();
    return { running: health.healthy === true, version: health.version, external: !managedChild };
  } catch (error) {
    return { running: false, external: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const getOpenCodeStatus = async (): Promise<OpenCodeStatus> => {
  const settings = await getOpenCodeSettings();
  const { running, version, external, error } = await isOpenCodeRunning();
  return {
    running,
    external: running ? external : false,
    managed: Boolean(managedChild && running),
    pid: managedChild?.pid,
    port: settings.port,
    hostname: settings.hostname,
    version,
    error,
  };
};

const resolveOpenCodeBin = (): string => {
  const envBin = process.env.OPENCODE_BIN;
  if (envBin) return envBin;

  const candidates: string[] = [];
  try {
    const out = execFileSync('where', ['opencode'], { encoding: 'utf8' });
    candidates.push(...out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    /* not found in PATH */
  }

  const exe = candidates.find((c) => c.toLowerCase().endsWith('.exe'));
  if (exe) return exe;

  if (process.platform === 'win32') {
    try {
      const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
      if (npmRoot) {
        const pkgExe = path.join(npmRoot, 'opencode-ai', 'bin', 'opencode.exe');
        if (existsSync(pkgExe)) return pkgExe;
      }
    } catch {
      /* npm global probe failed */
    }
  }

  const shim = candidates.find((c) => /\.(cmd|bat)$/i.test(c));
  if (shim) return shim;
  if (candidates.length > 0) return candidates[0];
  return 'opencode';
};

const spawnOpenCode = (
  bin: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean; stdio: ['ignore', 'pipe', 'pipe'] }
): ChildProcessByStdio<null, Readable, Readable> => {
  const isWindows = process.platform === 'win32';
  const isCmdShim = isWindows && /\.(cmd|bat)$/i.test(bin);
  if (isCmdShim) {
    return spawn(bin, args, { ...options, shell: 'cmd.exe' });
  }
  return spawn(bin, args, options);
};

export const startOpenCodeServer = async (projectPath?: string): Promise<OpenCodeStatus> => {
  const { running } = await isOpenCodeRunning();
  if (running) {
    return getOpenCodeStatus();
  }

  const settings = await getOpenCodeSettings();
  const bin = resolveOpenCodeBin();
  const cwd = projectPath && projectPath.trim() ? projectPath.trim() : process.cwd();

  const child = spawnOpenCode(bin, ['serve', '--port', String(settings.port), '--hostname', settings.hostname], {
    cwd,
    env: settings.password
      ? { ...process.env, OPENCODE_SERVER_PASSWORD: settings.password }
      : process.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  managedChild = child;
  appendLog(`[server] opencode serve iniciado (pid ${child.pid ?? '?'}, cwd ${cwd})`);

  child.stdout.on('data', (data: Buffer) => {
    data.toString('utf-8').split(/\r?\n/).forEach(appendLog);
  });
  child.stderr.on('data', (data: Buffer) => {
    data.toString('utf-8').split(/\r?\n/).forEach((l) => appendLog(`[stderr] ${l}`));
  });
  child.on('error', (error: Error) => {
    appendLog(`[error] ${error.message}`);
    managedChild = null;
  });
  child.on('exit', (code) => {
    appendLog(`[server] proceso finalizado con código ${code}`);
    if (managedChild === child) managedChild = null;
  });

  // Wait for the server to become healthy (max 15s)
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const state = await isOpenCodeRunning();
    if (state.running) {
      appendLog(`[server] saludable (${state.version ?? 'desconocida'})`);
      return getOpenCodeStatus();
    }
    if (managedChild !== child) break;
  }

  appendLog('[server] no respondió a tiempo, revisa el log');
  return getOpenCodeStatus();
};

export const stopOpenCodeServer = async (): Promise<OpenCodeStatus> => {
  const { running, external } = await isOpenCodeRunning();
  if (!running) {
    return getOpenCodeStatus();
  }
  if (external && !managedChild) {
    const status = await getOpenCodeStatus();
    return { ...status, error: 'Es un servidor externo; la app no lo puede detener.' };
  }
  if (managedChild) {
    managedChild.kill();
    managedChild = null;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return getOpenCodeStatus();
};

/** Kills a managed server. Safe to call during backend shutdown. */
export const stopManagedOpenCodeServer = (): void => {
  if (managedChild) {
    try {
      managedChild.kill();
    } catch {
      /* ignore */
    }
    managedChild = null;
  }
};
