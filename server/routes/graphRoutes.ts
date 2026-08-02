import { Router } from 'express';
import { z } from 'zod';
import { listGraphNodes, upsertGraphNode } from '../repositories/graphRepository';
import { handleRouteError } from './errorHandler';

const router = Router();

const graphNodeSchema = z.object({
  id: z.string().min(1),
  project_name: z.string().min(1),
  node_type: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional().default(''),
});

router.get('/:project', async (req, res) => {
  try {
    const { project } = req.params;
    res.json(await listGraphNodes(project));
  } catch (error) {
    console.error('Error fetching graph nodes:', error);
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = graphNodeSchema.parse(req.body ?? {});
    await upsertGraphNode(parsed);
    res.json({ status: 'ok', id: parsed.id });
  } catch (error) {
    console.error('Error saving graph node:', error);
    handleRouteError(error, res);
  }
});

export const graphRouter = router;
