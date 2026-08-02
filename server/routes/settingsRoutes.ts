import { Router } from 'express';
import { z } from 'zod';
import { getAppSettings, updateAppSettings } from '../repositories/settingsRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const appSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional().default('dark'),
  ollamaUrl: z.string().min(1).optional().default('http://localhost:11434'),
  ollamaMode: z.enum(['docker', 'local']).optional().default('local'),
});

router.get('/app', async (_req, res) => {
  try {
    res.json(await getAppSettings());
  } catch (error) {
    console.error('Error fetching app settings:', error);
    handleRouteError(error, res);
  }
});

router.put('/app', async (req, res) => {
  try {
    const parsed = appSettingsSchema.parse(req.body ?? {});
    await updateAppSettings(parsed);
    await writeAuditEvent('settings.updated', 'app_settings', 'global', null, parsed);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error saving app settings:', error);
    handleRouteError(error, res);
  }
});

export const settingsRouter = router;
