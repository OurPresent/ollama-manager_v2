import { Router } from 'express';
import { getSystemStats } from '../services/systemStatsService';
import { getModelUsage } from '../services/modelUsageService';
import { handleRouteError } from './errorHandler';

const router = Router();

router.get('/stats', async (_req, res) => {
  try {
    res.json(await getSystemStats());
  } catch (error) {
    console.error('Error fetching system stats:', error);
    handleRouteError(error, res);
  }
});

router.get('/model-usage', async (_req, res) => {
  try {
    res.json(await getModelUsage());
  } catch (error) {
    console.error('Error fetching model usage:', error);
    handleRouteError(error, res);
  }
});

export const systemRouter = router;
