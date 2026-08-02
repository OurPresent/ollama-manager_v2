import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SCRIPT = path.join(__dirname, '..', 'actions.py');

export interface PythonAction {
  action: string;
  [key: string]: unknown;
}

export interface PythonResult {
  success: boolean;
  [key: string]: unknown;
}

/**
 * Runs actions against the Python bridge (server/actions.py).
 * Encapsulates spawn/parse/error handling so routes stay thin.
 */
export class PythonRunner {
  private readonly script: string;
  private readonly pythonBin: string;

  constructor(script?: string, pythonBin = 'python') {
    this.script = script ?? DEFAULT_SCRIPT;
    this.pythonBin = pythonBin;
  }

  run(action: PythonAction, timeoutMs = 30000): Promise<PythonResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonBin, [this.script], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const ok = (result: PythonResult): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('error', (error: Error) => {
        const suffix = stderr.trim() ? ` (${stderr.trim()})` : '';
        fail(new Error(`Python error: ${error.message}${suffix}`));
      });

      child.on('close', (code: number | null) => {
        if (settled) return;
        if (code !== 0) {
          const suffix = stderr.trim() ? `: ${stderr.trim()}` : '';
          fail(new Error(`Python process exited with code ${code}${suffix}`));
          return;
        }
        try {
          ok(JSON.parse(stdout.trim()) as PythonResult);
        } catch {
          fail(new Error(`Failed to parse Python output: ${stdout.slice(0, 500)}`));
        }
      });

      try {
        child.stdin.write(JSON.stringify(action));
        child.stdin.end();
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

export const pythonRunner = new PythonRunner();
