import { Router } from 'express';
import { z } from 'zod';
import { pythonRunner } from '../services/pythonRunner';
import { writeAuditEvent, writeSystemLog } from '../core/audit';

const router = Router();

const actionSchema = z.object({
  action: z.string().min(1),
  project_path: z.string().min(1),
  path: z.string().optional().default(''),
  content: z.string().optional().default(''),
});

router.post('/execute', async (req, res) => {
  try {
    const parsed = actionSchema.parse(req.body ?? {});
    const result = await pythonRunner.run({ ...parsed }, 30000);
    await writeAuditEvent('action.executed', 'action', parsed.action, null, {
      target: parsed.path,
      success: Boolean(result.success),
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      await writeSystemLog('error', 'actions', error.message, { action: req.body?.action });
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export const actionRouter = router;
