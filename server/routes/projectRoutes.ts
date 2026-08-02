import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import {
  listProjects,
  getActiveProject,
  getProjectById,
  getProjectByRootPath,
  insertProject,
  updateProject,
  setAllProjectsInactive,
  activateProjectById,
} from '../repositories/projectRepository';
import { searchProjectFiles, listProjectFiles } from '../repositories/fileIndexRepository';
import { indexProject } from '../services/fileIndexService';
import { listContextBlocks } from '../repositories/contextRepository';
import { writeFileAccessLog } from '../repositories/fileAccessRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
  description: z.string().optional().default(''),
});

router.get('/', async (_req, res) => {
  try {
    res.json(await listProjects());
  } catch (error) {
    console.error('Error fetching projects:', error);
    handleRouteError(error, res);
  }
});

router.get('/active', async (_req, res) => {
  try {
    res.json((await getActiveProject()) ?? null);
  } catch (error) {
    console.error('Error fetching active project:', error);
    handleRouteError(error, res);
  }
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body ?? {});
    const normalizedRootPath = path.resolve(parsed.rootPath);

    if (!fs.existsSync(normalizedRootPath)) {
      res.status(400).json({ error: 'The provided project path does not exist' });
      return;
    }
    if (!fs.statSync(normalizedRootPath).isDirectory()) {
      res.status(400).json({ error: 'The provided project path is not a directory' });
      return;
    }

    const existing = await getProjectByRootPath(normalizedRootPath);
    if (existing) {
      await updateProject(existing.id, {
        name: parsed.name,
        description: parsed.description,
      });
      await writeAuditEvent('project.updated', 'project', existing.id, existing.id, {
        rootPath: normalizedRootPath,
      });
      res.json({ status: 'ok', project: { ...existing, name: parsed.name, description: parsed.description } });
      return;
    }

    const projectId = await insertProject({
      name: parsed.name,
      rootPath: normalizedRootPath,
      description: parsed.description,
    });
    await writeAuditEvent('project.created', 'project', projectId, projectId, {
      rootPath: normalizedRootPath,
    });

    res.json({
      status: 'ok',
      project: {
        id: projectId,
        name: parsed.name,
        root_path: normalizedRootPath,
        description: parsed.description,
        is_active: 0,
      },
    });
  } catch (error) {
    console.error('Error registering project:', error);
    handleRouteError(error, res);
  }
});

router.post('/:id/resolve-references', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const parsed = z
      .object({ refs: z.array(z.string()).max(50).default([]) })
      .parse(req.body ?? {});
    const root = path.resolve(project.root_path);

    const resolved: { path: string; content: string }[] = [];
    const missing: string[] = [];

    for (const ref of parsed.refs) {
      const safeRel = ref.replace(/\\/g, '/');
      const resolvedPath = path.resolve(root, safeRel);
      if (resolvedPath !== root && !resolvedPath.startsWith(root + path.sep)) {
        missing.push(ref);
        continue;
      }
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        missing.push(ref);
        continue;
      }

      resolved.push({ path: safeRel, content: fs.readFileSync(resolvedPath, 'utf8') });
    }

    if (resolved.length > 0) {
      await writeFileAccessLog({
        projectId: id,
        relativePath: resolved.map((r) => r.path).join(','),
        source: 'chat',
        details: { endpoint: 'resolve-references', count: resolved.length },
      });
    }

    res.json({ resolved, missing });
  } catch (error) {
    console.error('Error resolving references:', error);
    handleRouteError(error, res);
  }
});

router.get('/:id/context', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const blocks = await listContextBlocks(id);
    if (blocks.length === 0) {
      await indexProject(project);
    }
    res.json({ blocks: blocks.length > 0 ? blocks : await listContextBlocks(id) });
  } catch (error) {
    console.error('Error fetching project context:', error);
    handleRouteError(error, res);
  }
});

router.post('/:id/index', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const indexed = await indexProject(project);
    res.json({ status: 'ok', indexedFiles: indexed });
  } catch (error) {
    console.error('Error indexing project:', error);
    handleRouteError(error, res);
  }
});

router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { q } = req.query;
    const query = typeof q === 'string' ? q.trim() : '';
    const files = query
      ? await searchProjectFiles(id, query)
      : await listProjectFiles(id);

    res.json({ files });
  } catch (error) {
    console.error('Error listing project files:', error);
    handleRouteError(error, res);
  }
});

router.get('/:id/files/content', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!relPath) {
      res.status(400).json({ error: 'Missing path query parameter' });
      return;
    }

    const safeRel = relPath.replace(/\\/g, '/');
    const resolved = path.resolve(project.root_path, safeRel);
    const root = path.resolve(project.root_path);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      res.status(400).json({ error: 'Invalid path: outside project root' });
      return;
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    await writeFileAccessLog({
      projectId: id,
      relativePath: safeRel,
      source: 'api',
      details: { endpoint: 'files/content' },
    });

    res.json({
      path: safeRel,
      content: fs.readFileSync(resolved, 'utf8'),
    });
  } catch (error) {
    console.error('Error reading file:', error);
    handleRouteError(error, res);
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await setAllProjectsInactive();
    await activateProjectById(id);
    await writeAuditEvent('project.activated', 'project', id, id);
    res.json({ status: 'ok', project: { ...project, is_active: 1 } });
  } catch (error) {
    console.error('Error activating project:', error);
    handleRouteError(error, res);
  }
});

export const projectRouter = router;
