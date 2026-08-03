import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';

export interface NewPlan {
  projectId: string;
  title: string;
  goal: string;
  content: string;
}

export const insertPlan = async (plan: NewPlan): Promise<string> => {
  const id = createId('plan');
  await execute(
    `INSERT INTO plans (id, project_id, title, goal, content, status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP)`,
    [id, plan.projectId, plan.title, plan.goal, plan.content]
  );
  return id;
};

export const updatePlan = async (id: string, data: { title: string; goal: string; content: string }): Promise<void> => {
  await execute(
    `UPDATE plans
     SET title = ?, goal = ?, content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.title, data.goal, data.content, id]
  );
};

export const getPlanById = async (id: string): Promise<DbRow | null> => {
  return queryOne('SELECT * FROM plans WHERE id = ? LIMIT 1', [id]);
};

export const listPlans = async (projectId?: string): Promise<DbRow[]> => {
  return projectId
    ? queryAll('SELECT * FROM plans WHERE project_id = ? ORDER BY updated_at DESC LIMIT 100', [projectId])
    : queryAll('SELECT * FROM plans ORDER BY updated_at DESC LIMIT 100');
};

export const insertPlanRun = async (planId: string, projectId: string): Promise<string> => {
  const id = createId('prun');
  await execute(
    `INSERT INTO plan_runs (id, plan_id, project_id, status, started_at)
     VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)`,
    [id, planId, projectId]
  );
  return id;
};

export const finishPlanRun = async (
  id: string,
  status: 'completed' | 'error' | 'cancelled',
  summary: string
): Promise<void> => {
  await execute(
    `UPDATE plan_runs
     SET status = ?, summary = ?, finished_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, summary, id]
  );
};

export const listPlanRuns = async (planId: string): Promise<DbRow[]> => {
  return queryAll('SELECT * FROM plan_runs WHERE plan_id = ? ORDER BY started_at DESC', [planId]);
};

export const getPlanRunById = async (id: string): Promise<DbRow | null> => {
  return queryOne('SELECT * FROM plan_runs WHERE id = ? LIMIT 1', [id]);
};

export const insertAgentRun = async (data: {
  agentId: string;
  projectId: string;
  planRunId: string;
  modelName: string;
}): Promise<string> => {
  const id = createId('arun');
  await execute(
    `INSERT INTO agent_runs (id, agent_id, project_id, plan_run_id, model_name, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'running', CURRENT_TIMESTAMP)`,
    [id, data.agentId, data.projectId, data.planRunId, data.modelName]
  );
  return id;
};

export const finishAgentRun = async (
  id: string,
  status: 'completed' | 'error',
  output: string
): Promise<void> => {
  await execute(
    `UPDATE agent_runs
     SET status = ?, output = ?, finished_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, output, id]
  );
};

export const listAgentRuns = async (planRunId: string): Promise<DbRow[]> => {
  return queryAll('SELECT * FROM agent_runs WHERE plan_run_id = ? ORDER BY started_at ASC', [planRunId]);
};

// ---- Pasos / etapas ------------------------------------------------------

export interface NewPlanStep {
  agentId?: string;
  agentName: string;
  role?: string;
  modelName?: string;
}

export const insertPlanSteps = async (
  planRunId: string,
  steps: NewPlanStep[]
): Promise<string[]> => {
  const ids: string[] = [];
  let order = 0;
  for (const step of steps) {
    const id = createId('pstep');
    ids.push(id);
    await execute(
      `INSERT INTO plan_steps (id, plan_run_id, agent_id, agent_name, role, step_order, model_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        planRunId,
        step.agentId ?? null,
        step.agentName,
        step.role ?? '',
        order,
        step.modelName ?? '',
      ]
    );
    order += 1;
  }
  return ids;
};

export const listPlanSteps = async (planRunId: string): Promise<DbRow[]> => {
  return queryAll('SELECT * FROM plan_steps WHERE plan_run_id = ? ORDER BY step_order ASC', [planRunId]);
};

export const getPlanStepById = async (id: string): Promise<DbRow | null> => {
  return queryOne('SELECT * FROM plan_steps WHERE id = ? LIMIT 1', [id]);
};

export const updatePlanStep = async (id: string, data: {
  status?: 'pending' | 'running' | 'needs_approval' | 'completed' | 'error' | 'cancelled';
  output?: string;
  feedback?: string;
}): Promise<void> => {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.status !== undefined) {
    sets.push('status = ?');
    params.push(data.status);
    if (data.status === 'running') sets.push('started_at = COALESCE(started_at, CURRENT_TIMESTAMP)');
    if (data.status === 'completed' || data.status === 'error' || data.status === 'cancelled') {
      sets.push('finished_at = CURRENT_TIMESTAMP');
    }
  }
  if (data.output !== undefined) {
    sets.push('output = ?');
    params.push(data.output);
  }
  if (data.feedback !== undefined) {
    sets.push('feedback = ?');
    params.push(data.feedback);
  }
  if (sets.length === 0) return;
  params.push(id);
  await execute(`UPDATE plan_steps SET ${sets.join(', ')} WHERE id = ?`, params);
};
