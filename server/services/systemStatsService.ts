import { pythonRunner } from './pythonRunner';

export interface SystemStats {
  totalRam: number;
  usedRam: number;
  freeRam: number;
  usedPct: number;
  ollamaRam: number;
}

export const getSystemStats = async (): Promise<SystemStats> => {
  const result = await pythonRunner.run({ action: 'system_stats' }, 15000);
  if (!result.success) {
    throw new Error(String(result.error ?? 'Failed to read system stats'));
  }
  const r = (result.result ?? {}) as Record<string, unknown>;
  return {
    totalRam: Number(r.total_ram ?? 0),
    usedRam: Number(r.used_ram ?? 0),
    freeRam: Number(r.free_ram ?? 0),
    usedPct: Number(r.used_pct ?? 0),
    ollamaRam: Number(r.ollama_ram ?? 0),
  };
};
