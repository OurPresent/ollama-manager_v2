const API_BASE = '/api/figma';

export interface FigmaFrameInfo {
  id: string;
  name: string;
  w: number;
  h: number;
}

export interface FigmaStatus {
  hasToken: boolean;
  maskedToken: string | null;
}

export interface FigmaPreview {
  fileName: string;
  fileKey: string;
  frames: FigmaFrameInfo[];
}

export interface FigmaFramePreview {
  nodeId: string;
  name: string;
  w: number;
  h: number;
  preview: string | null;
}

export interface FigmaImportResult {
  base: string;
  dir: string;
  files: Array<{ path: string; type: 'tsx' | 'html' | 'css' | 'png' }>;
  stats: { frames: number; nodes: number; textNodes: number; images: number };
}

const parseError = async (res: Response): Promise<Error> => {
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const msg = typeof data?.error === 'string' ? data.error : 'No se pudo completar la operación con Figma.';
  return new Error(msg);
};

export const getFigmaStatus = async (): Promise<FigmaStatus> => {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FigmaStatus;
};

export const saveFigmaToken = async (token: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/token`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw await parseError(res);
};

export const clearFigmaToken = async (): Promise<void> => {
  const res = await fetch(`${API_BASE}/token`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
};

export const previewFigmaFile = async (fileKey: string, token?: string): Promise<FigmaPreview> => {
  const res = await fetch(`${API_BASE}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKey, token }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FigmaPreview;
};

export const previewFigmaFrame = async (
  fileKey: string,
  nodeId: string,
  token?: string
): Promise<FigmaFramePreview> => {
  const res = await fetch(`${API_BASE}/preview-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKey, nodeId, token }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FigmaFramePreview;
};

export const importFigma = async (
  fileKey: string,
  nodeId: string,
  token?: string
): Promise<FigmaImportResult> => {
  const res = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKey, nodeId, token }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FigmaImportResult;
};