import fs from 'fs';
import path from 'path';
import { getActiveProject } from '../repositories/projectRepository';

const FIGMA_API = 'https://api.figma.com';

// ---- Tipos --------------------------------------------------------------

interface CssStyle {
  [key: string]: string;
}

interface NormalizedNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  width: number;
  height: number;
  isText: boolean;
  text: string;
  children: NormalizedNode[];
  style: CssStyle;
  hasImageFill: boolean;
}

interface RawNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  cornerRadius?: number;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  children?: RawNode[];
  characters?: string;
  style?: RawTextStyle;
  fontName?: { family?: string; style?: string };
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | null;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  layoutAlign?: string;
  layoutGrow?: number;
  strokes?: RawPaint[];
  strokeWeight?: number;
  effects?: RawEffect[];
  fills?: RawPaint[];
}

interface RawTextStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  textAlignHorizontal?: string;
}

interface RawPaint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  imageRef?: string;
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
  gradientTransform?: number[];
}

interface RawEffect {
  type: string;
  color?: { r: number; g: number; b: number; a?: number };
  radius?: number;
  offset?: { x: number; y: number };
}

export interface FrameInfo {
  id: string;
  name: string;
  w: number;
  h: number;
}

export interface ImportStats {
  frames: number;
  nodes: number;
  textNodes: number;
  images: number;
}

export interface ImportResult {
  base: string;
  dir: string;
  files: Array<{ path: string; type: 'tsx' | 'html' | 'css' | 'png' }>;
  stats: ImportStats;
}

// ---- Utils --------------------------------------------------------------

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

const colorToCss = (c: { r: number; g: number; b: number; a?: number }, opacityMul = 1): string => {
  const a = clamp01(c.a ?? 1) * clamp01(opacityMul);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.round(a * 100) / 100})`;
};

const sanitizeName = (name: string): string =>
  (name || 'figma-import')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'figma-import';

const alignMap: Record<string, string> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between',
  SPACE_AROUND: 'space-around',
};

const camelToKebab = (k: string): string => k.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

// ---- Cliente Figma ------------------------------------------------------

const figmaRequest = async (token: string, pathname: string): Promise<unknown> => {
  const res = await fetch(`${FIGMA_API}${pathname}`, {
    headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Figma API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

export const extractFileKey = (raw: string): string | null => {
  const t = (raw || '').trim();
  if (/^[A-Za-z0-9]{10,}$/.test(t)) return t;
  const m = t.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
};

export const fetchFigmaFile = async (token: string, fileKey: string): Promise<RawNode> => {
  const data = (await figmaRequest(token, `/v1/files/${fileKey}`)) as { document?: RawNode };
  if (!data?.document) throw new Error('El archivo de Figma no devolvió un documento válido.');
  return data.document;
};

export const exportFigmaImage = async (
  token: string,
  fileKey: string,
  nodeId: string
): Promise<string | null> => {
  const data = (await figmaRequest(
    token,
    `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`
  )) as { images?: Record<string, string | null> };
  const url = data?.images?.[nodeId];
  if (!url) return null;
  try {
    const buff = await (await fetch(url)).arrayBuffer();
    return Buffer.from(buff).toString('base64');
  } catch {
    return null;
  }
};

// ---- Normalización ------------------------------------------------------

const resolveGradient = (paint: RawPaint): CssStyle | null => {
  const stops = (paint.gradientStops ?? [])
    .filter((s) => s && s.color)
    .map((s) => `${colorToCss(s.color)} ${Math.round((s.position ?? 0) * 100)}%`);
  if (stops.length < 2) return null;
  const t = paint.gradientTransform ?? [1, 0];
  const angle = Math.round((Math.atan2(t[1] ?? 0, t[0] ?? 1) * 180) / Math.PI);
  return { background: `linear-gradient(${angle}deg, ${stops.join(', ')})` };
};

const resolvePaint = (paint: RawPaint | undefined, opacityMul: number): CssStyle => {
  if (!paint) return {};
  if (paint.type === 'IMAGE') return paint.visible === false ? {} : { background: 'rgba(0,0,0,0.06)' };
  if (paint.type === 'SOLID' && paint.color)
    return { backgroundColor: colorToCss(paint.color, (paint.opacity ?? 1) * opacityMul) };
  if (paint.type === 'GRADIENT_LINEAR') return resolveGradient(paint) ?? {};
  return {};
};

const resolveEffects = (effects: RawEffect[] | undefined): CssStyle => {
  const shadows: string[] = [];
  for (const e of effects ?? []) {
    if (e.type === 'DROP_SHADOW' && e.color) {
      shadows.push(`${(e.offset?.x ?? 0)}px ${(e.offset?.y ?? 0)}px ${e.radius ?? 0}px ${colorToCss(e.color)}`);
    } else if (e.type === 'INNER_SHADOW' && e.color) {
      shadows.push(`inset ${(e.offset?.x ?? 0)}px ${(e.offset?.y ?? 0)}px ${e.radius ?? 0}px ${colorToCss(e.color)}`);
    }
  }
  return shadows.length ? { boxShadow: shadows.join(', ') } : {};
};

const weightNames: Record<string, string> = {
  Thin: '100',
  'Extra Light': '200',
  Light: '300',
  Regular: '400',
  Medium: '500',
  Semibold: '600',
  Bold: '700',
  'Extra Bold': '800',
  Black: '900',
};

const normalizeNode = (raw: RawNode, offX = 0, offY = 0): NormalizedNode | null => {
  const box = raw.absoluteBoundingBox;
  if (!box) return null;
  const isText = raw.type === 'TEXT';
  const visible = raw.visible !== false;

  const node: NormalizedNode = {
    id: raw.id,
    name: raw.name || 'node',
    type: raw.type,
    visible,
    width: box.width,
    height: box.height,
    isText,
    text: isText ? (raw.characters ?? '') : '',
    children: [],
    style: {},
    hasImageFill: false,
  };

  if (!box.width && !box.height && !isText) return node;

  const px = raw.type === 'CANVAS' ? 0 : box.x - offX;
  const py = raw.type === 'CANVAS' ? 0 : box.y - offY;

  // fills
  const fill = raw.fills?.[0];
  const opacity = clamp01(raw.opacity ?? 1);
  node.hasImageFill = fill?.type === 'IMAGE' && fill.visible !== false;
  if (isText) {
    node.style = resolvePaint(fill, 1);
    const s = raw.style ?? {};
    if (s.fontFamily || raw.fontName?.family) node.style.fontFamily = `'${s.fontFamily || raw.fontName?.family}', sans-serif`;
    if (s.fontSize) node.style.fontSize = `${s.fontSize}px`;
    if (s.fontWeight) node.style.fontWeight = `${s.fontWeight}`;
    else if (raw.fontName?.style) node.style.fontWeight = weightNames[raw.fontName.style] ?? '400';
    const lhPx = s.lineHeightPx;
    if (lhPx && lhPx > 0) node.style.lineHeight = `${Math.round(lhPx)}px`;
    else if (s.lineHeightPercent && s.fontSize) node.style.lineHeight = `${Math.round((s.lineHeightPercent / 100) * s.fontSize)}px`;
    if (s.letterSpacing !== undefined) node.style.letterSpacing = `${s.letterSpacing}px`;
    if (s.textAlignHorizontal === 'CENTER') node.style.textAlign = 'center';
    else if (s.textAlignHorizontal === 'RIGHT') node.style.textAlign = 'right';
    else if (s.textAlignHorizontal === 'JUSTIFIED') node.style.textAlign = 'justify';
    node.style.whiteSpace = 'pre-wrap';
  } else {
    node.style = resolvePaint(fill, opacity);
    if (!Number.isNaN(box.width)) node.style.width = `${box.width}px`;
    if (!Number.isNaN(box.height)) node.style.height = `${box.height}px`;
    if (raw.cornerRadius && raw.cornerRadius > 0) node.style.borderRadius = `${raw.cornerRadius}px`;
  }

  Object.assign(node.style, resolveEffects(raw.effects));

  const stroke = raw.strokes?.[0];
  if (stroke && stroke.color && stroke.visible !== false) {
    node.style.border = `${raw.strokeWeight || 1}px solid ${colorToCss(stroke.color)}`;
  }

  // layout
  if (!isText && raw.layoutMode) {
    node.style.display = 'flex';
    if (raw.layoutMode === 'HORIZONTAL') node.style.flexDirection = 'row';
    if (raw.itemSpacing) node.style.gap = `${raw.itemSpacing}px`;
    node.style.justifyContent = alignMap[raw.primaryAxisAlignItems ?? 'MIN'] ?? 'flex-start';
    node.style.alignItems = alignMap[raw.counterAxisAlignItems ?? 'MIN'] ?? 'flex-start';
    const pt = raw.paddingTop ?? 0;
    const pr = raw.paddingRight ?? 0;
    const pb = raw.paddingBottom ?? 0;
    const pl = raw.paddingLeft ?? 0;
    if (pt || pr || pb || pl) {
      node.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    }
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
  } else if (!isText) {
    node.style.position = 'absolute';
    node.style.left = `${Math.round(px * 100) / 100}px`;
    node.style.top = `${Math.round(py * 100) / 100}px`;
  }

  if (!isText && raw.layoutGrow) node.style.flexGrow = '1';
  if (raw.layoutAlign === 'STRETCH') node.style.alignSelf = 'stretch';
  if (visible === false) node.style.display = 'none';
  else if (opacity < 1) node.style.opacity = `${Math.round(opacity * 100) / 100}`;

  node.children = (raw.children ?? [])
    .map((c) => normalizeNode(c, raw.type === 'CANVAS' ? 0 : box.x, raw.type === 'CANVAS' ? 0 : box.y))
    .filter((n) => n !== null) as NormalizedNode[];

  return node;
};

// ---- Renderers ----------------------------------------------------------

const jsonStyle = (style: CssStyle): string => {
  const entries = Object.entries(style).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return ` style={{ ${entries.map(([k, v]) => `${k}: '${v}'`).join(', ')} }}`;
};

const cssLine = (k: string, v: string): string => `  ${camelToKebab(k)}: ${v};`;

// TSX
const renderTsx = (node: NormalizedNode, indent: number, out: string[]): void => {
  const pad = '  '.repeat(indent);
  if (!node.visible) return;
  const style = jsonStyle(node.style);
  if (node.isText) {
    out.push(`${pad}<div${style}>{${JSON.stringify(node.text)}}</div>`);
    return;
  }
  if (node.children.length === 0) {
    out.push(`${pad}<div${style} />`);
    return;
  }
  out.push(`${pad}<div${style}>`);
  node.children.forEach((c) => renderTsx(c, indent + 1, out));
  out.push(`${pad}</div>`);
};

const buildTsx = (node: NormalizedNode, base: string): string => {
  const out: string[] = [];
  renderTsx(node, 2, out);
  return [
    `import React from 'react';`,
    ``,
    `/** Generado desde Figma: ${base} */`,
    `const ${toComponentName(base)}: React.FC = () => {`,
    `  return (`,
    ...out,
    `  );`,
    `};`,
    ``,
    `export default ${toComponentName(base)};`,
    ``,
  ].join('\n');
};

// HTML + CSS
const renderHtmlCss = (node: NormalizedNode, out: string[], css: string[], counter: { n: number }): void => {
  if (!node.visible) return;
  const cls = `f-${counter.n}`;
  counter.n += 1;
  css.push(`.${cls} {`);
  Object.entries(node.style).forEach(([k, v]) => css.push(cssLine(k, v)));
  css.push('}');
  if (node.isText) {
    out.push(`<div class="${cls}">${escHtml(node.text)}</div>`);
    return;
  }
  if (node.children.length === 0) {
    out.push(`<div class="${cls}"></div>`);
    return;
  }
  out.push(`<div class="${cls}">`);
  node.children.forEach((c) => renderHtmlCss(c, out, css, counter));
  out.push(`</div>`);
};

const buildHtml = (node: NormalizedNode, base: string): { html: string; css: string } => {
  const out: string[] = [];
  const css: string[] = [];
  renderHtmlCss(node, out, css, { n: 0 });
  const html = `<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${htmlEsc(base)}</title>\n  <link rel="stylesheet" href="${base}.css" />\n</head>\n<body>\n${out.join('\n')}\n</body>\n</html>\n`;
  const cssText = `/* Generado desde Figma: ${base} */\n\n${css.join('\n')}\n`;
  return { html, css: cssText };
};

const toComponentName = (base: string): string => {
  const parts = base
    .split('-')
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1)));
  const name = parts.length ? parts.join('') : 'figmaImport';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const escHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const htmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- Import -------------------------------------------------------------

export const listFrames = (root: RawNode): FrameInfo[] => {
  const frames: FrameInfo[] = [];
  const walk = (node: RawNode): void => {
    if (node.type === 'CANVAS') {
      for (const child of node.children ?? []) {
        const box = child.absoluteBoundingBox;
        if (box && (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'COMPONENT_SET' || child.type === 'SECTION')) {
          frames.push({ id: child.id, name: child.name || 'Frame', w: box.width, h: box.height });
        }
        walk(child);
      }
    } else {
      for (const child of node.children ?? []) walk(child);
    }
  };
  walk(root);
  return frames;
};

export const findNodeById = (node: RawNode, id: string): RawNode | null => {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

const countNodes = (node: NormalizedNode, stats: Required<Omit<ImportStats, 'frames'>>): void => {
  stats.nodes += 1;
  if (node.isText) stats.textNodes += 1;
  if (node.hasImageFill && !node.isText) stats.images += 1;
  node.children.forEach((c) => countNodes(c, stats));
};

export const importFigmaToProject = async (
  token: string,
  fileKey: string,
  nodeId: string
): Promise<ImportResult> => {
  const project = await getActiveProject();
  if (!project?.root_path) throw new Error('No hay un proyecto activo para importar la plantilla.');
  const file = await fetchFigmaFile(token, fileKey);
  const raw = findNodeById(file, nodeId);
  if (!raw) throw new Error(`No se encontró el frame "${nodeId}" en el archivo.`);

  const norm = normalizeNode(raw, raw.absoluteBoundingBox?.x ?? 0, raw.absoluteBoundingBox?.y ?? 0);
  if (!norm) throw new Error('No se pudo procesar el frame seleccionado.');

  const base = sanitizeName(raw.name);
  const dir = path.join(project.root_path, 'figma-imports', base);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

  const files: ImportResult['files'] = [];

  // TSX
  const tsx = buildTsx(norm, base);
  const tsxPath = path.join(dir, `${base}.tsx`);
  fs.writeFileSync(tsxPath, tsx, 'utf-8');
  files.push({ path: tsxPath, type: 'tsx' });

  // HTML + CSS
  const { html, css } = buildHtml(norm, base);
  const htmlPath = path.join(dir, `${base}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  files.push({ type: 'html', path: htmlPath });
  const cssPath = path.join(dir, `${base}.css`);
  fs.writeFileSync(cssPath, css, 'utf-8');
  files.push({ type: 'css', path: cssPath });

  const stats: Required<Omit<ImportStats, 'frames'>> = { nodes: 0, textNodes: 0, images: 0 };
  countNodes(norm, stats);

  // PNG del frame completo
  try {
    const png = await exportFigmaImage(token, fileKey, nodeId);
    if (png) {
      const pngPath = path.join(dir, `${base}.png`);
      fs.writeFileSync(pngPath, Buffer.from(png, 'base64'));
      files.push({ type: 'png', path: pngPath });
    }
  } catch {
    // best-effort
  }

  return { base, dir, files, stats: { frames: 1, ...stats } };
};