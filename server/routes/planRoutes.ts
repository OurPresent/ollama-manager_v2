import { Router } from 'express';
import { z } from 'zod';
import {
  insertPlan,
  updatePlan,
  getPlanById,
  listPlans,
  insertPlanRun,
  finishPlanRun,
  listPlanRuns,
  getPlanRunById,
  getLatestActiveRunForProject,
  insertAgentRun,
  finishAgentRun,
  listAgentRuns,
  insertPlanSteps,
  listPlanSteps,
  getPlanStepById,
  updatePlanStep,
} from '../repositories/planRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const planSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  content: z.string().min(1),
});

router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    res.json(await listPlans(typeof projectId === 'string' ? projectId : undefined));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/resume', async (req, res) => {
  try {
    const { projectId } = z
      .object({ projectId: z.string().min(1) })
      .parse(req.query);
    const run = await getLatestActiveRunForProject(projectId);
    if (!run) {
      res.json({ run: null, plan: null });
      return;
    }
    const plan = await getPlanById(String(run.plan_id));
    res.json({ run, plan });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const plan = await getPlanById(req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    res.json(plan);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = planSchema.parse(req.body ?? {});
    const id = await insertPlan(parsed);
    await writeAuditEvent('plan.created', 'plan', id, parsed.projectId, {
      title: parsed.title,
      goal: parsed.goal,
    });
    res.json({ status: 'ok', id });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = planSchema.partial().parse(req.body ?? {});
    const existing = await getPlanById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    await updatePlan(req.params.id, {
      title: parsed.title ?? String(existing.title),
      goal: parsed.goal ?? String(existing.goal),
      content: parsed.content ?? String(existing.content),
    });
    await writeAuditEvent('plan.updated', 'plan', req.params.id, String(existing.project_id ?? ''));
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/:id/runs', async (req, res) => {
  try {
    res.json(await listPlanRuns(req.params.id));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/runs', async (req, res) => {
  try {
    const plan = await getPlanById(req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    const runId = await insertPlanRun(req.params.id, String(plan.project_id ?? ''));
    await writeAuditEvent('plan.run_started', 'plan_run', runId, String(plan.project_id ?? ''), {
      planId: req.params.id,
    });
    res.json({ status: 'ok', runId });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/runs/:runId/finish', async (req, res) => {
  try {
    const { runId } = req.params;
    const parsed = z
      .object({ status: z.enum(['completed', 'error', 'cancelled']), summary: z.string().optional().default('') })
      .parse(req.body ?? {});
    const run = await getPlanRunById(runId);
    if (!run) {
      res.status(404).json({ error: 'Plan run not found' });
      return;
    }
    await finishPlanRun(runId, parsed.status, parsed.summary);
    await writeAuditEvent('plan.run_finished', 'plan_run', runId, String(run.project_id ?? ''), {
      status: parsed.status,
    });
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/runs/:runId/agents', async (req, res) => {
  try {
    res.json(await listAgentRuns(req.params.runId));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/runs/:runId/agents', async (req, res) => {
  try {
    const { runId } = req.params;
    const parsed = z
      .object({ agentId: z.string().min(1), modelName: z.string().min(1) })
      .parse(req.body ?? {});
    const run = await getPlanRunById(runId);
    if (!run) {
      res.status(404).json({ error: 'Plan run not found' });
      return;
    }
    const agentRunId = await insertAgentRun({
      agentId: parsed.agentId,
      projectId: String(run.project_id ?? ''),
      planRunId: runId,
      modelName: parsed.modelName,
    });
    res.json({ status: 'ok', agentRunId });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/agent-runs/:agentRunId/finish', async (req, res) => {
  try {
    const { agentRunId } = req.params;
    const parsed = z
      .object({ status: z.enum(['completed', 'error']), output: z.string().optional().default('') })
      .parse(req.body ?? {});
    await finishAgentRun(agentRunId, parsed.status, parsed.output);
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

// ---- Pasos / etapas ------------------------------------------------------

router.post('/runs/:runId/steps', async (req, res) => {
  try {
    const { runId } = req.params;
    const parsed = z
      .object({
        steps: z
          .array(
            z.object({
              agentId: z.string().optional(),
              agentName: z.string().min(1),
              role: z.string().optional().default(''),
              modelName: z.string().optional().default(''),
            })
          )
          .min(1),
      })
      .parse(req.body ?? {});
    const run = await getPlanRunById(runId);
    if (!run) {
      res.status(404).json({ error: 'Plan run not found' });
      return;
    }
    const ids = await insertPlanSteps(runId, parsed.steps);
    res.json({ status: 'ok', stepIds: ids });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/runs/:runId/steps', async (req, res) => {
  try {
    const { runId } = req.params;
    res.json(await listPlanSteps(runId));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.patch('/steps/:stepId', async (req, res) => {
  try {
    const { stepId } = req.params;
    const parsed = z
      .object({
        status: z.enum(['pending', 'running', 'needs_approval', 'completed', 'error', 'cancelled']).optional(),
        output: z.string().optional(),
        feedback: z.string().optional(),
      })
      .parse(req.body ?? {});
    const existing = await getPlanStepById(stepId);
    if (!existing) {
      res.status(404).json({ error: 'Plan step not found' });
      return;
    }
    await updatePlanStep(stepId, parsed);
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

export const planRouter = router;
