import { Router } from 'express';
import {
  getCatalog,
  getIntegration,
  getIntegrationStatus,
  buildGuideMarkdown,
} from '../services/integrationsService';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const catalog = getCatalog();
    const detected = catalog.filter((i) => i.detected).length;
    const categories = Array.from(new Set(catalog.map((i) => i.category)));
    res.json({
      integrations: catalog,
      summary: { total: catalog.length, detected, categories },
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const status = getIntegrationStatus(String(req.params.id));
    if (!status) {
      res.status(404).json({ error: 'Integración no encontrada' });
      return;
    }
    res.json(status);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/:id/guide', async (req, res) => {
  try {
    const status = getIntegrationStatus(String(req.params.id));
    if (!status) {
      res.status(404).json({ error: 'Integración no encontrada' });
      return;
    }
    res.type('text/plain').send(buildGuideMarkdown(status));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/detect', async (req, res) => {
  try {
    const integration = getIntegration(String(req.params.id));
    if (!integration) {
      res.status(404).json({ error: 'Integración no encontrada' });
      return;
    }
    const status = getIntegrationStatus(integration.id);
    await writeAuditEvent('integrations.detect', 'integration', integration.id, null, {
      detected: status?.detected,
    });
    res.json(status);
  } catch (error) {
    handleRouteError(error, res);
  }
});

export const integrationsRouter = router;
