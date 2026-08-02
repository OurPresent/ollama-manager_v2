import { Router } from 'express';
import { z } from 'zod';
import {
  listOllamaModels,
  getRunningModels,
  loadModel,
  stopModel,
} from '../services/ollamaService';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const modelSchema = z.object({
  model: z.string().min(1),
});

router.get('/models', async (_req, res) => {
  try {
    const result = await listOllamaModels();
    res.json(result);
  } catch (error) {
    console.error('Error listing Ollama models:', error);
    handleRouteError(error, res);
  }
});

router.get('/running', async (_req, res) => {
  try {
    const result = await getRunningModels();
    res.json(result);
  } catch (error) {
    console.error('Error fetching running models:', error);
    handleRouteError(error, res);
  }
});

router.post('/models/load', async (req, res) => {
  try {
    const { model } = modelSchema.parse(req.body ?? {});
    const result = await loadModel(model);
    await writeAuditEvent('ollama.model.load', 'model', model, null, { success: Boolean((result as { success?: boolean }).success) });
    res.json(result);
  } catch (error) {
    console.error('Error loading Ollama model:', error);
    handleRouteError(error, res);
  }
});

router.post('/models/stop', async (req, res) => {
  try {
    const { model } = modelSchema.parse(req.body ?? {});
    const result = await stopModel(model);
    await writeAuditEvent('ollama.model.stop', 'model', model, null, { success: Boolean((result as { success?: boolean }).success) });
    res.json(result);
  } catch (error) {
    console.error('Error stopping Ollama model:', error);
    handleRouteError(error, res);
  }
});

export const ollamaRouter = router;
