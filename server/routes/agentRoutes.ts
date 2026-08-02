import { Router } from 'express';
import { z } from 'zod';
import {
  listActiveAgents,
  getAgentById,
  insertAgent,
  updateAgent,
  deactivateAgent,
  listAgentVersions,
} from '../repositories/agentRepository';
import type { AgentRow } from '../core/types';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const agentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  description: z.string().optional().default(''),
  model: z.string().optional().default(''),
});

const mapAgentRow = (row: AgentRow) => ({
  id: row.id,
  name: row.name,
  role: row.role,
  description: row.description,
  systemPrompt: row.system_prompt,
  model: row.model || '',
  isBuiltin: Boolean(row.is_builtin),
  status: 'idle' as const,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get('/', async (_req, res) => {
  try {
    const rows = await listActiveAgents();
    res.json(rows.map(mapAgentRow));
  } catch (error) {
    console.error('Error fetching agents:', error);
    handleRouteError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = agentSchema.parse(req.body ?? {});
    const id = await insertAgent({
      name: parsed.name,
      role: parsed.role,
      systemPrompt: parsed.systemPrompt,
      description: parsed.description,
      model: parsed.model,
      isBuiltin: false,
    });
    await writeAuditEvent('agent.created', 'agent', id, null, { name: parsed.name, role: parsed.role });
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error creating agent:', error);
    handleRouteError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = agentSchema.parse(req.body ?? {});
    const existing = await getAgentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    await updateAgent(id, parsed);
    await writeAuditEvent('agent.updated', 'agent', id, null, { name: parsed.name, role: parsed.role });
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error updating agent:', error);
    handleRouteError(error, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deactivateAgent(id);
    await writeAuditEvent('agent.deactivated', 'agent', id, null);
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error deleting agent:', error);
    handleRouteError(error, res);
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getAgentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const versions = await listAgentVersions(id);
    res.json(
      versions.map((v: unknown) => {
        const row = v as { id: string; version: number; name: string; role: string; description: string; system_prompt: string; created_at: string };
        return {
          id: row.id,
          version: row.version,
          name: row.name,
          role: row.role,
          description: row.description,
          systemPrompt: row.system_prompt,
          createdAt: row.created_at,
        };
      })
    );
  } catch (error) {
    console.error('Error fetching agent versions:', error);
    handleRouteError(error, res);
  }
});

export const agentRouter = router;
