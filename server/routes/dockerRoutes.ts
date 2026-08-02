import { Router } from 'express';
import { z } from 'zod';
import { pythonRunner } from '../services/pythonRunner';
import { getAppSettings } from '../repositories/settingsRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const controlSchema = z
  .object({
    mode: z.enum(['docker', 'local']).optional(),
  })
  .optional();

const resolveMode = async (mode?: 'docker' | 'local'): Promise<'docker' | 'local'> => {
  if (mode) return mode;
  const settings = await getAppSettings();
  return settings.ollamaMode;
};

router.get('/ollama/status', async (_req, res) => {
  try {
    const mode = await resolveMode();
    const result = await pythonRunner.run({ action: 'docker_check_ollama', mode }, 15000);
    res.json({
      running: Boolean(result.running),
      details: (result.details as string) || 'No info',
      mode: (result.mode as string) || 'unknown',
    });
  } catch (error) {
    console.error('Error checking Ollama status:', error);
    res.json({
      running: false,
      details: error instanceof Error ? error.message : 'Failed to check Ollama status',
      mode: 'unknown',
    });
  }
});

router.post('/ollama/start', async (req, res) => {
  try {
    const body = controlSchema.parse(req.body ?? {});
    const mode = await resolveMode(body?.mode);
    const result = await pythonRunner.run({ action: 'docker_start_ollama', mode }, 60000);
    await writeAuditEvent('ollama.start', 'service', 'ollama', null, { mode, success: Boolean(result.success) });
    if (result.success) {
      res.json({ status: 'ok', message: result.result, output: result.output || '' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to start Ollama', output: result.output || '' });
    }
  } catch (error) {
    console.error('Error starting Ollama:', error);
    handleRouteError(error, res);
  }
});

router.post('/ollama/stop', async (req, res) => {
  try {
    const body = controlSchema.parse(req.body ?? {});
    const mode = await resolveMode(body?.mode);
    const result = await pythonRunner.run({ action: 'docker_stop_ollama', mode }, 30000);
    await writeAuditEvent('ollama.stop', 'service', 'ollama', null, { mode, success: Boolean(result.success) });
    if (result.success) {
      res.json({ status: 'ok', message: result.result, output: result.output || '' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to stop Ollama', output: result.output || '' });
    }
  } catch (error) {
    console.error('Error stopping Ollama:', error);
    handleRouteError(error, res);
  }
});

router.post('/ollama/restart', async (req, res) => {
  try {
    const body = controlSchema.parse(req.body ?? {});
    const mode = await resolveMode(body?.mode);
    const result = await pythonRunner.run({ action: 'docker_restart_ollama', mode }, 30000);
    await writeAuditEvent('ollama.restart', 'service', 'ollama', null, { mode, success: Boolean(result.success) });
    if (result.success) {
      res.json({ status: 'ok', message: result.result, output: result.output || '' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to restart Ollama', output: result.output || '' });
    }
  } catch (error) {
    console.error('Error restarting Ollama:', error);
    handleRouteError(error, res);
  }
});

router.get('/info', async (_req, res) => {
  try {
    const result = await pythonRunner.run({ action: 'docker_get_info' }, 15000);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Docker info:', error);
    handleRouteError(error, res);
  }
});

export const dockerRouter = router;
