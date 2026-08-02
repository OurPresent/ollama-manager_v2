import { Router } from 'express';
import { z } from 'zod';
import { listTaskLogs, upsertTaskLog } from '../repositories/logRepository';
import { handleRouteError } from './errorHandler';

const router = Router();

const logSchema = z.object({
  task_id: z.string().min(1),
  project_name: z.string().min(1),
  title: z.string().min(1),
  markdown_content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
});

router.get('/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const logs = await listTaskLogs(project);
    res.json(
      logs.map((log) => ({
        ...log,
        tags: safeParseTags(log.tags),
      }))
    );
  } catch (error) {
    console.error('Error fetching logs:', error);
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = logSchema.parse(req.body ?? {});
    await upsertTaskLog(parsed);
    res.json({ status: 'ok', task_id: parsed.task_id });
  } catch (error) {
    console.error('Error saving log:', error);
    handleRouteError(error, res);
  }
});

const safeParseTags = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const logRouter = router;
