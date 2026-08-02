import { Router } from 'express';
import { z } from 'zod';
import {
  listSessions,
  getSession,
  insertSession,
  updateSessionTitle,
  touchSession,
  deleteSession,
  listMessages,
  insertMessage,
} from '../repositories/chatRepository';
import { handleRouteError } from './errorHandler';

const router = Router();

const sessionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  title: z.string().min(1),
});

const messageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  status: z.string().optional(),
});

router.get('/sessions', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    res.json(await listSessions(projectId));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    handleRouteError(error, res);
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    handleRouteError(error, res);
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const parsed = sessionSchema.parse(req.body ?? {});
    await insertSession(parsed);
    res.json({ status: 'ok', id: parsed.id });
  } catch (error) {
    console.error('Error creating session:', error);
    handleRouteError(error, res);
  }
});

router.put('/sessions/:id/title', async (req, res) => {
  try {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body ?? {});
    await updateSessionTitle(req.params.id, title);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error updating session title:', error);
    handleRouteError(error, res);
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ status: 'ok', id: req.params.id });
  } catch (error) {
    console.error('Error deleting session:', error);
    handleRouteError(error, res);
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  try {
    res.json(await listMessages(req.params.id));
  } catch (error) {
    console.error('Error fetching messages:', error);
    handleRouteError(error, res);
  }
});

router.post('/messages', async (req, res) => {
  try {
    const parsed = messageSchema.parse(req.body ?? {});
    await insertMessage(parsed);
    await touchSession(parsed.sessionId);
    res.json({ status: 'ok', id: parsed.id });
  } catch (error) {
    console.error('Error saving message:', error);
    handleRouteError(error, res);
  }
});

export const chatRouter = router;
