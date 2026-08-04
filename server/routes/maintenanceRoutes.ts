import { Router } from 'express';
import { z } from 'zod';
import { cleanupData, CleanupTargets } from '../repositories/maintenanceRepository';
import { getDbSizeBytes, vacuumDb } from '../db';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const targetsSchema = z.object({
  chats: z.boolean().optional().default(false),
  opencode: z.boolean().optional().default(false),
  plans: z.boolean().optional().default(false),
  taskLogs: z.boolean().optional().default(false),
  queries: z.boolean().optional().default(false),
  graph: z.boolean().optional().default(false),
  audit: z.boolean().optional().default(false),
  systemLogs: z.boolean().optional().default(false),
  approvals: z.boolean().optional().default(false),
});

router.get('/size', async (_req, res) => {
  try {
    res.json({ sizeBytes: await getDbSizeBytes() });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const parsed = z
      .object({
        targets: targetsSchema,
        olderThanDays: z.number().int().min(0).optional().default(0),
        projectId: z.string().optional(),
      })
      .parse(req.body ?? {});
    const before = await getDbSizeBytes();
    const result = await cleanupData({
      targets: parsed.targets as CleanupTargets,
      olderThanDays: parsed.olderThanDays,
      projectId: parsed.projectId,
    });
    const after = await getDbSizeBytes();
    await writeAuditEvent('maintenance.cleanup', 'system', 'global', parsed.projectId ?? null, {
      counts: result.counts,
      olderThanDays: parsed.olderThanDays,
    });
    res.json({ counts: result.counts, sizeBytesBefore: before, sizeBytesAfter: after });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/compact', async (_req, res) => {
  try {
    const before = await getDbSizeBytes();
    await vacuumDb();
    const after = await getDbSizeBytes();
    await writeAuditEvent('maintenance.compact', 'system', 'global', null, {
      sizeBytesBefore: before,
      sizeBytesAfter: after,
    });
    res.json({ sizeBytesBefore: before, sizeBytesAfter: after });
  } catch (error) {
    handleRouteError(error, res);
  }
});

export const maintenanceRouter = router;
