import { Router } from 'express';
import { queryAll } from '../repositories/db';
import { handleRouteError } from './errorHandler';

const router = Router();

router.get('/events', async (req, res) => {
  try {
    const { projectId } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const rows = projectId
      ? await queryAll(
          'SELECT * FROM audit_events WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
          [String(projectId), limit]
        )
      : await queryAll('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching audit events:', error);
    handleRouteError(error, res);
  }
});

router.get('/logs', async (_req, res) => {
  try {
    const limit = Math.min(Math.max(Number(_req.query.limit) || 50, 1), 500);
    const rows = await queryAll(
      'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching system logs:', error);
    handleRouteError(error, res);
  }
});

router.get('/file-access', async (req, res) => {
  try {
    const { projectId } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const rows = projectId
      ? await queryAll(
          'SELECT * FROM file_access_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
          [String(projectId), limit]
        )
      : await queryAll('SELECT * FROM file_access_log ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching file access log:', error);
    handleRouteError(error, res);
  }
});

export const auditRouter = router;
