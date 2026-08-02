import { Router } from 'express';
import { z } from 'zod';
import {
  getDeviceInfo,
  prepareEnvironment,
  createBackup,
  restoreBackup,
} from '../services/deviceService';
import type { BackupPayload } from '../services/deviceService';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

router.get('/info', async (_req, res) => {
  try {
    res.json(await getDeviceInfo());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/prepare', async (_req, res) => {
  try {
    const report = await prepareEnvironment();
    await writeAuditEvent('device.prepare', 'device', 'environment', null, {
      checks: report.checks.length,
      suggestions: report.suggestions.length,
    });
    res.json(report);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/backup', async (_req, res) => {
  try {
    const payload = await createBackup();
    res.json(payload);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/restore', async (req, res) => {
  try {
    const parsed = z
      .object({
        app: z.string(),
        version: z.string(),
        exportedAt: z.string(),
        databaseBase64: z.string(),
        sizeBytes: z.number().optional(),
      })
      .parse(req.body ?? {});
    await restoreBackup(parsed as BackupPayload);
    await writeAuditEvent('device.restore', 'device', 'database', null, { sizeBytes: parsed.sizeBytes ?? 0 });
    res.json({ status: 'ok', message: 'Base de datos restaurada correctamente.' });
  } catch (error) {
    console.error('Error restoring backup:', error);
    handleRouteError(error, res);
  }
});

export const deviceRouter = router;
