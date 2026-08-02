import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  getOpenCodeStatus,
  startOpenCodeServer,
  stopOpenCodeServer,
  getOpenCodeSettings,
  saveOpenCodeSettings,
  getOpenCodeClient,
  getOpenCodeLogTail,
} from '../services/opencodeServerManager';
import { extractAssistantText, extractToolSummaries, type OpenCodeMessageResult } from '../services/opencodeClient';
import {
  upsertStoredSession,
  insertStoredMessage,
  listOpenCodeQueryLog,
  touchStoredSession,
} from '../repositories/opencodeRepository';
import {
  readConfigFile,
  writeConfigFile,
  applyOllamaProvider,
  applyPermissions,
  getPermissionsSummary,
} from '../services/opencodeConfigService';
import { createId } from '../core/utils';
import { writeAuditEvent, writeSystemLog } from '../core/audit';
import { handleRouteError } from './errorHandler';
import { getActiveProject } from '../repositories/projectRepository';

const router = Router();

const scopeSchema = z.enum(['project', 'global']);

const requireServer = async (res: Response): Promise<ReturnType<typeof getOpenCodeClient> | null> => {
  const status = await getOpenCodeStatus();
  if (!status.running) {
    res.status(503).json({ error: 'El servidor de OpenCode no está en ejecución. Inícialo desde la pestaña de Estado.' });
    return null;
  }
  return getOpenCodeClient();
};

// ---- Estado / ciclo de vida ----

router.get('/status', async (_req, res) => {
  try {
    const status = await getOpenCodeStatus();
    res.json({ ...status, logTail: getOpenCodeLogTail() });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/start', async (req, res) => {
  try {
    const parsed = z.object({ projectPath: z.string().optional() }).parse(req.body ?? {});
    const project = await getActiveProject();
    const projectPath = parsed.projectPath ?? project?.root_path ?? undefined;
    const status = await startOpenCodeServer(projectPath);
    await writeSystemLog('info', 'opencode', 'Servidor OpenCode iniciado', { port: status.port, cwd: projectPath });
    await writeAuditEvent('opencode.server.start', 'opencode', 'server', project?.id ?? null, { port: status.port });
    res.json({ ...status, logTail: getOpenCodeLogTail() });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/stop', async (_req, res) => {
  try {
    const status = await stopOpenCodeServer();
    await writeSystemLog('info', 'opencode', 'Servidor OpenCode detenido');
    await writeAuditEvent('opencode.server.stop', 'opencode', 'server', null, {});
    res.json({ ...status, logTail: getOpenCodeLogTail() });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/settings', async (_req, res) => {
  try {
    res.json(await getOpenCodeSettings());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/settings', async (req, res) => {
  try {
    const parsed = z
      .object({
        port: z.number().int().positive().max(65535),
        hostname: z.string().min(1),
        password: z.string().optional().default(''),
        autoStart: z.boolean().optional().default(false),
      })
      .parse(req.body ?? {});
    await saveOpenCodeSettings(parsed);
    res.json({ status: 'ok' });
  } catch (error) {
    handleRouteError(error, res);
  }
});

// ---- Lectura del servidor ----

router.get('/health', async (_req, res) => {
  const client = await getOpenCodeClient(4000);
  try {
    res.json(await client.health());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/project', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.project());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/config/providers', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.configProviders());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/provider', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.providers());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/agents', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.agents());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/commands', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.commands());
  } catch (error) {
    handleRouteError(error, res);
  }
});

// ---- Sesiones ----

router.get('/sessions', async (_req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.listSessions());
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/sessions', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    const parsed = z.object({ title: z.string().optional(), projectId: z.string().nullable().optional() }).parse(req.body ?? {});
    const created = await client.createSession(parsed.title);
    const id = String(created.id ?? '');
    const title = String(created.title ?? parsed.title ?? 'Nuevo Chat OpenCode');
    if (id) {
      await upsertStoredSession({ id, projectId: parsed.projectId, title });
    }
    await writeAuditEvent('opencode.session.create', 'opencode_session', id, parsed.projectId ?? null, { title });
    res.json(created);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/sessions/:id', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.getSession(req.params.id));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.delete('/sessions/:id', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    await client.deleteSession(req.params.id);
    res.json({ status: 'ok', id: req.params.id });
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.sessionMessages(req.params.id));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/sessions/:id/abort', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    res.json(await client.abort(req.params.id));
  } catch (error) {
    handleRouteError(error, res);
  }
});

// ---- Mensajes / comandos (persistencia por proyecto) ----

const persistExchange = async (args: {
  sessionId: string;
  projectId?: string | null;
  title: string;
  agent?: string;
  model?: string;
  prompt: string;
  result: OpenCodeMessageResult;
}): Promise<void> => {
  const { sessionId, projectId, title, agent, model, prompt, result } = args;
  const assistantText = extractAssistantText(result);

  await upsertStoredSession({ id: sessionId, projectId, title, agent, model });
  await insertStoredMessage({
    id: createId('ocmsg'),
    sessionId,
    role: 'user',
    content: prompt,
    model,
    agent,
    metadata: { parts: result.parts },
  });
  if (assistantText) {
    await insertStoredMessage({
      id: createId('ocmsg'),
      sessionId,
      role: 'assistant',
      content: assistantText,
      model,
      agent,
    });
  }
  await touchStoredSession(sessionId, { agent, model, title });
};

router.post('/sessions/:id/message', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    const parsed = z
      .object({
        content: z.string().min(1),
        model: z.string().optional(),
        agent: z.string().optional(),
        projectId: z.string().nullable().optional(),
        title: z.string().optional(),
      })
      .parse(req.body ?? {});

    let title = parsed.title ?? '';
    if (!title) {
      try {
        const session = await client.getSession(req.params.id);
        title = String(session.title ?? '');
      } catch {
        title = parsed.content.slice(0, 40);
      }
    }
    if (!title) title = parsed.content.slice(0, 40);

    const result = await client.sendMessage(req.params.id, {
      model: parsed.model,
      agent: parsed.agent,
      parts: [{ type: 'text', text: parsed.content }],
    });

    await persistExchange({
      sessionId: req.params.id,
      projectId: parsed.projectId,
      title,
      agent: parsed.agent,
      model: parsed.model,
      prompt: parsed.content,
      result,
    });

    const assistantText = extractAssistantText(result);
    res.json({
      info: result.info,
      parts: result.parts,
      assistantText,
      toolSummaries: extractToolSummaries(result),
    });
  } catch (error) {
    console.error('Error sending message to OpenCode:', error);
    handleRouteError(error, res);
  }
});

router.post('/sessions/:id/command', async (req, res) => {
  const client = await requireServer(res);
  if (!client) return;
  try {
    const parsed = z
      .object({
        command: z.string().min(1),
        arguments: z.string().optional().default(''),
        model: z.string().optional(),
        agent: z.string().optional(),
        projectId: z.string().nullable().optional(),
        title: z.string().optional(),
      })
      .parse(req.body ?? {});

    const result = await client.runCommand(req.params.id, {
      command: parsed.command,
      arguments: parsed.arguments,
      model: parsed.model,
      agent: parsed.agent,
    });

    const prompt = parsed.arguments ? `/${parsed.command} ${parsed.arguments}` : `/${parsed.command}`;

    await persistExchange({
      sessionId: req.params.id,
      projectId: parsed.projectId,
      title: parsed.title ?? prompt.slice(0, 40),
      agent: parsed.agent,
      model: parsed.model,
      prompt,
      result,
    });

    res.json({
      info: result.info,
      parts: result.parts,
      assistantText: extractAssistantText(result),
      toolSummaries: extractToolSummaries(result),
    });
  } catch (error) {
    console.error('Error running OpenCode command:', error);
    handleRouteError(error, res);
  }
});

// ---- Configuración (opencode.json) ----

router.get('/config-file', async (req, res) => {
  try {
    const scope = scopeSchema.parse(req.query.scope ?? 'project');
    res.json(await readConfigFile(scope));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/config-file', async (req, res) => {
  try {
    const parsed = z
      .object({ scope: scopeSchema, content: z.string().min(1) })
      .parse(req.body ?? {});
    const result = await writeConfigFile(parsed.scope, parsed.content);
    await writeAuditEvent('opencode.config.write', 'opencode_config', parsed.scope, null, { path: result.path });
    res.json(result);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/config-file/ollama', async (req, res) => {
  try {
    const parsed = z
      .object({
        scope: scopeSchema,
        ollamaUrl: z.string().min(1).optional().default('http://localhost:11434'),
        models: z.array(z.string().min(1)).default([]),
        model: z.string().optional(),
      })
      .parse(req.body ?? {});
    const result = await applyOllamaProvider(parsed.scope, {
      ollamaUrl: parsed.ollamaUrl,
      models: parsed.models,
      model: parsed.model,
    });
    await writeAuditEvent('opencode.config.ollama', 'opencode_config', parsed.scope, null, {
      path: result.path,
      models: parsed.models.length,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.get('/config/permissions', async (req, res) => {
  try {
    const scope = scopeSchema.parse(req.query.scope ?? 'project');
    res.json(await getPermissionsSummary(scope));
  } catch (error) {
    handleRouteError(error, res);
  }
});

router.post('/config/permissions', async (req, res) => {
  try {
    const parsed = z
      .object({
        scope: scopeSchema,
        autoApprove: z.boolean(),
        read: z.enum(['allow', 'ask', 'deny']),
        edit: z.enum(['allow', 'ask', 'deny']),
        bash: z.enum(['allow', 'ask', 'deny']),
        webfetch: z.enum(['allow', 'ask', 'deny']),
        websearch: z.enum(['allow', 'ask', 'deny']),
      })
      .parse(req.body ?? {});
    const result = await applyPermissions(parsed.scope, {
      autoApprove: parsed.autoApprove,
      read: parsed.read,
      edit: parsed.edit,
      bash: parsed.bash,
      webfetch: parsed.webfetch,
      websearch: parsed.websearch,
    });
    await writeAuditEvent('opencode.config.permissions', 'opencode_config', parsed.scope, null, {
      path: result.path,
      autoApprove: parsed.autoApprove,
    });
    res.json(result);
  } catch (error) {
    handleRouteError(error, res);
  }
});

// ---- Historial de consultas persistidas (por proyecto) ----

router.get('/queries', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' && req.query.projectId ? req.query.projectId : undefined;
    res.json(await listOpenCodeQueryLog(projectId));
  } catch (error) {
    handleRouteError(error, res);
  }
});

export const opencodeRouter = router;
