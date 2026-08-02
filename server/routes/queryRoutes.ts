import { Router } from 'express';
import { z } from 'zod';
import { listQueries, insertQuery } from '../repositories/queryRepository';
import { handleRouteError } from './errorHandler';

const router = Router();

const querySchema = z.object({
  project_name: z.string().min(1),
  title: z.string().min(1),
  raw_query: z.string().min(1),
  optimized_query: z.string().nullable().optional(),
  execution_time_ms: z.number().nullable().optional(),
});

router.get('/:project', async (req, res) => {
  try {
    const { project } = req.params;
    res.json(await listQueries(project));
  } catch (error) {
    console.error('Error fetching queries:', error);
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = querySchema.parse(req.body ?? {});
    const id = await insertQuery(parsed);
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error saving query:', error);
    handleRouteError(error, res);
  }
});

export const queryRouter = router;
