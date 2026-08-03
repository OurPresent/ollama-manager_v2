import { Router } from 'express';
import { z } from 'zod';
import { getSetting, setSetting, deleteSetting } from '../repositories/settingsRepository';
import { writeAuditEvent } from '../core/audit';
import { handleRouteError } from './errorHandler';
import {
  extractFileKey,
  fetchFigmaFile,
  exportFigmaImage,
  findNodeById,
  importFigmaToProject,
  listFrames,
} from '../services/figmaService';

const router = Router();

const TOKEN_KEY = 'figma_token';

const bodyToken = async (token?: string): Promise<string> => {
  if (token && token.length >= 20) return token;
  const stored = await getSetting(TOKEN_KEY);
  if (stored) return stored;
  throw new Error('No hay token de Figma configurado. Guárdalo primero o pásalo en el request.');
};

router.get('/status', async (_req, res) => {
  try {
    const stored = await getSetting(TOKEN_KEY);
    res.json({ hasToken: Boolean(stored), maskedToken: stored ? `${stored.slice(0, 4)}…${stored.slice(-4)}` : null });
  } catch (error) {
    console.error('Error checking figma status:', error);
    handleRouteError(error, res);
  }
});

router.put('/token', async (req, res) => {
  try {
    const { token } = z.object({ token: z.string().min(20, 'El token de Figma es demasiado corto.') }).parse(req.body ?? {});
    await setSetting(TOKEN_KEY, token.trim());
    await writeAuditEvent('figma.token.updated', 'app_settings', 'global', null, { hasToken: true });
    res.json({ hasToken: true });
  } catch (error) {
    console.error('Error saving figma token:', error);
    handleRouteError(error, res);
  }
});

router.delete('/token', async (_req, res) => {
  try {
    await deleteSetting(TOKEN_KEY);
    await writeAuditEvent('figma.token.removed', 'app_settings', 'global', null);
    res.json({ hasToken: false });
  } catch (error) {
    console.error('Error removing figma token:', error);
    handleRouteError(error, res);
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { fileKey: rawKey, token } = z
      .object({ fileKey: z.string().min(1), token: z.string().optional() })
      .parse(req.body ?? {});
    const fileKey = extractFileKey(rawKey) ?? rawKey.trim();
    const resolved = await bodyToken(token);
    const document = await fetchFigmaFile(resolved, fileKey);
    const fileName = (document as { name?: string }).name ?? 'Archivo';
    const frames = listFrames(document);
    res.json({ fileName, fileKey, frames });
  } catch (error) {
    console.error('Error previewing figma file:', error);
    handleRouteError(error, res);
  }
});

router.post('/preview-frame', async (req, res) => {
  try {
    const { fileKey, nodeId, token } = z
      .object({ fileKey: z.string().min(1), nodeId: z.string().min(1), token: z.string().optional() })
      .parse(req.body ?? {});
    const resolved = await bodyToken(token);

    const document = await fetchFigmaFile(resolved, fileKey);
    const raw = findNodeById(document, nodeId);
    if (!raw) throw new Error('No se encontró el frame seleccionado en el archivo.');

    const image = await exportFigmaImage(resolved, fileKey, nodeId);
    const preview = image ? `data:image/png;base64,${image}` : null;

    res.json({
      nodeId,
      name: raw.name,
      w: raw.absoluteBoundingBox?.width ?? 0,
      h: raw.absoluteBoundingBox?.height ?? 0,
      preview,
    });
  } catch (error) {
    console.error('Error previewing figma frame:', error);
    handleRouteError(error, res);
  }
});

router.post('/import', async (req, res) => {
  try {
    const { fileKey, nodeId, token } = z
      .object({ fileKey: z.string().min(1), nodeId: z.string().min(1), token: z.string().optional() })
      .parse(req.body ?? {});
    const resolved = await bodyToken(token);
    const result = await importFigmaToProject(resolved, fileKey, nodeId);
    await writeAuditEvent('figma.import', 'project', nodeId, null, {
      nodeId,
      base: result.base,
      files: result.files.length,
    });
    res.json(result);
  } catch (error) {
    console.error('Error importing figma:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    handleRouteError(error, res);
  }
});

export const figmaRouter = router;