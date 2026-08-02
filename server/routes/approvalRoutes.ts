import { Router } from 'express';
import { z } from 'zod';
import {
  insertApprovalRequest,
  listApprovalRequests,
  getApprovalRequestById,
  resolveApprovalRequest,
} from '../repositories/approvalRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const createSchema = z.object({
  projectId: z.string().nullable().optional().default(null),
  scopeType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional().default({}),
});

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'alternative']),
  selectedAlternative: z.number().optional(),
  feedback: z.string().optional().default(''),
});

router.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    res.json(await listApprovalRequests(status, limit));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body ?? {});
    const id = await insertApprovalRequest(parsed);
    await writeAuditEvent('approval.requested', 'approval', id, parsed.projectId, {
      scopeType: parsed.scopeType,
      title: parsed.title,
    });
    res.json({ status: 'ok', id });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/decide', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = decideSchema.parse(req.body ?? {});
    const existing = await getApprovalRequestById(id);
    if (!existing) {
      res.status(404).json({ error: 'Approval request not found' });
      return;
    }

    const status = parsed.decision === 'alternative' ? 'approved' : parsed.decision;
    await resolveApprovalRequest(id, status, parsed.decision, parsed.selectedAlternative, parsed.feedback);
    await writeAuditEvent('approval.resolved', 'approval', id, String(existing.project_id ?? ''), {
      decision: parsed.decision,
      selectedAlternative: parsed.selectedAlternative,
    });
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

export const approvalRouter = router;
