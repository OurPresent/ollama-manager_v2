import { Router } from 'express';
import { z } from 'zod';
import {
  listSkills,
  getSkillById,
  deleteSkill,
  importSkills,
  exportSkills,
  normalizeSkillItem,
  setSkillActive,
  setSkillScope,
  type SkillRow,
} from '../repositories/skillRepository';
import {
  installSkillToDisk,
  uninstallSkillFromDisk,
  listInstalledOnDisk,
} from '../services/skillInstaller';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const scopeSchema = z.enum(['project', 'global']);

const TEMPLATE_ITEM = JSON.stringify(
  {
    name: 'backend-node',
    description: 'Ayuda a construir backends Node/Express con buenas prácticas.',
    content:
      '# Backend Node\n\nCrea servidores Express con TypeScript, validación con zod y errores tipados.\n\n## Reglas\n- Usa zod para validar request bodies.\n- Centraliza errores con handleRouteError.',
    references: [
      { path: 'guides/crud.md', content: '# CRUD guide\n...' },
    ],
    scope: 'project',
    enabled: true,
  },
  null,
  2
);

router.get('/', async (_req, res) => {
  try {
    const skills = await listSkills();
    const installed = await listInstalledOnDisk();
    res.json(
      skills.map((s) => ({
        ...s,
        installedProject: installed.some((i) => i.name === s.name && i.scope === 'project'),
        installedGlobal: installed.some((i) => i.name === s.name && i.scope === 'global'),
      }))
    );
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/installed', async (_req, res) => {
  try {
    res.json(await listInstalledOnDisk());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/template', (_req, res) => {
  res.json({
    format: 'array',
    items: TEMPLATE_ITEM,
    headers: ['name*', 'content*', 'description', 'references', 'scope', 'enabled'],
  });
});

router.post('/validate', async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(z.unknown()).min(1) }).parse(req.body ?? {});
    const errors: Array<{ index: number; name: string; error: string }> = [];
    const valid: Array<{ name: string; description: string }> = [];
    for (let i = 0; i < parsed.items.length; i++) {
      const { skill, error } = normalizeSkillItem(parsed.items[i], i);
      if (error || !skill) errors.push({ index: i, name: '', error: error ?? 'item inválido' });
      else valid.push({ name: skill.name, description: skill.description ?? '' });
    }
    res.json({ valid: valid.length, errors, total: parsed.items.length });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/import', async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(z.unknown()).min(1) }).parse(req.body ?? {});
    const result = await importSkills(parsed.items);

    // Instalar en disco los skills importados/actualizados
    let installed = 0;
    let failedInstall = 0;
    const installedErrors: string[] = [];
    for (const item of parsed.items) {
      const { skill, error } = normalizeSkillItem(item, 0);
      if (error || !skill) continue;
      const row = await getSkillByNameFromRepo(skill.name);
      if (!row) continue;
      try {
        await installSkillToDisk(row);
        installed++;
      } catch (e) {
        failedInstall++;
        installedErrors.push(`${skill.name}: ${e instanceof Error ? e.message : 'error de instalación'}`);
      }
    }

    await writeAuditEvent('skills.import', 'skill', 'bulk', null, {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      installed,
      failedInstall,
    });
    res.json({ status: 'ok', ...result, installed, failedInstall, installedErrors });
  } catch (error) {
    console.error('Error importing skills:', error);
    handleRouteError(error, res);
  }
});

router.get('/export', async (_req, res) => {
  try {
    const items = await exportSkills();
    res.json({ items, count: items.length });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const parsed = z.object({ active: z.boolean() }).parse(req.body ?? {});
    const id = String(req.params.id);
    await setSkillActive(id, parsed.active);
    await writeAuditEvent('skills.toggle', 'skill', id, null, { active: parsed.active });
    res.json({ status: 'ok', id, active: parsed.active });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/install', async (req, res) => {
  try {
    const id = String(req.params.id);
    const parsed = z.object({ scope: scopeSchema.optional() }).parse(req.body ?? {});
    const row = await getSkillById(id);
    if (!row) {
      res.status(404).json({ error: 'Skill no encontrado' });
      return;
    }
    if (parsed.scope) await setSkillScope(id, parsed.scope);
    const fresh = (await getSkillById(id)) as SkillRow;
    const result = await installSkillToDisk(fresh);
    await writeAuditEvent('skills.install', 'skill', id, null, { scope: fresh.scope, dir: result.dir });
    res.json({ status: 'ok', ...result });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/:id/uninstall', async (req, res) => {
  try {
    const id = String(req.params.id);
    const row = await getSkillById(id);
    const name = row?.name ?? '';
    const removed = await uninstallSkillFromDisk(name);
    await writeAuditEvent('skills.uninstall', 'skill', id, null, { removed: removed.length });
    res.json({ status: 'ok', id, removed });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const row = await getSkillById(id);
    await deleteSkill(id);
    const removed = await uninstallSkillFromDisk(row?.name ?? '');
    await writeAuditEvent('skills.delete', 'skill', id, null, { removed: removed.length });
    res.json({ status: 'ok', id, removed });
  } catch (error) {
    handleRouteError(error, res);
  }
});

async function getSkillByNameFromRepo(name: string): Promise<SkillRow | null> {
  const rows = await listSkills();
  return rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export const skillsRouter = router;
