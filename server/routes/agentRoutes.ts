import { Router } from 'express';
import { z } from 'zod';
import {
  listActiveAgents,
  listAllAgents,
  getAgentById,
  insertAgent,
  updateAgent,
  deactivateAgent,
  setAgentActive,
  listAgentVersions,
  importAgents,
  normalizeAgentItem,
} from '../repositories/agentRepository';import type { AgentRow } from '../core/types';
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
  isActive: Boolean(row.is_active),
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

router.get('/all', async (_req, res) => {
  try {
    const rows = await listAllAgents();
    res.json(rows.map(mapAgentRow));
  } catch (error) {
    console.error('Error fetching all agents:', error);
    handleRouteError(error, res);
  }
});

router.patch('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = z.object({ active: z.boolean() }).parse(req.body ?? {});
    const existing = await getAgentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    await setAgentActive(id, parsed.active);
    await writeAuditEvent('agent.active.toggle', 'agent', id, null, { active: parsed.active });
    res.json({ status: 'ok', id, active: parsed.active });
  } catch (error) {
    console.error('Error toggling agent:', error);
    handleRouteError(error, res);
  }
});

router.post('/import', async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(z.unknown()).min(1) }).parse(req.body ?? {});
    const result = await importAgents(parsed.items);
    await writeAuditEvent('agent.import', 'agent', 'bulk', null, {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      total: result.total,
    });
    res.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('Error importing agents:', error);
    handleRouteError(error, res);
  }
});

router.get('/import/template', (_req, res) => {
  res.json({
    format: 'array',
    items: JSON.stringify(
      [
        {
          name: 'Arquitecto de Soluciones',
          role: 'Solution Architect',
          description: 'Diseña la arquitectura técnica del sistema y valida las decisiones clave.',
          systemPrompt:
            'Eres un Arquitecto de Soluciones Senior. Diseña arquitecturas escalables, seguras y basadas en principios de separación de responsabilidades. Sé conciso y estructurado.',
          model: '',
        },
        {
          name: 'Backend Developer',
          role: 'Backend Developer',
          description: 'Implementa endpoints REST con Express + TypeScript y validación con zod.',
          systemPrompt:
            'Eres un ingeniero backend especializado en Node.js/Express con TypeScript. Usa zod para validar request bodies y centraliza errores con handleRouteError.',
          model: 'deepseek-coder:6.7b',
        },
      ],
      null,
      2
    ),
    headers: ['name*', 'role*', 'systemPrompt*', 'description', 'model'],
  });
});

router.post('/import/validate', async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(z.unknown()).min(1) }).parse(req.body ?? {});
    const errors: Array<{ index: number; name: string; error: string }> = [];
    const valid: Array<{ name: string; role: string }> = [];
    for (let i = 0; i < parsed.items.length; i++) {
      const { agent, error } = normalizeAgentItem(parsed.items[i], i);
      if (error || !agent) errors.push({ index: i, name: '', error: error ?? 'item inválido' });
      else valid.push({ name: agent.name, role: agent.role });
    }
    res.json({ valid: valid.length, errors, total: parsed.items.length });
  } catch (error) {
    console.error('Error validating agents:', error);
    handleRouteError(error, res);
  }
});

router.get('/export', async (_req, res) => {
  try {
    const rows = await listAllAgents();
    res.json({
      items: rows.map((a) => ({
        name: a.name,
        role: a.role,
        description: a.description ?? '',
        systemPrompt: a.system_prompt,
        model: a.model || undefined,
      })),
      count: rows.length,
    });
  } catch (error) {
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
