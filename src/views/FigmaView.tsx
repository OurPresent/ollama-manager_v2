import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Upload,
  Loader2,
  Download,
  Eye,
  Trash2,
  Link2,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  getFigmaStatus,
  saveFigmaToken,
  clearFigmaToken,
  previewFigmaFile,
  previewFigmaFrame,
  importFigma,
  FigmaFrameInfo,
  FigmaPreview,
  FigmaFramePreview,
  FigmaImportResult,
} from '../services/figma';
import { useToast } from '../components/Toast';

const FigmaIcon: React.FC<{ className?: string }> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm3.75 6.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    <path d="M12 1.5c-.414 0-.825.016-1.233.046 2.516 1.634 4.108 4.616 4.108 8.12 0 2.65-.972 5.053-2.588 6.862 1.361.43 2.82.672 4.315.672A10.5 10.5 0 0 0 12 1.5Z" />
    <path d="M4.933 3.412A10.47 10.47 0 0 0 1.5 8.25c0 2.202.658 4.205 1.758 5.807-.41-.735-.65-1.553-.65-2.47 0-2.4.958-4.544 2.325-6.082Z" />
    <path d="M8.095 5.12C9.64 3.782 11.742 3 14 3c1.244 0 2.429.228 3.503.648-.68.98-1.558 1.846-2.582 2.51A2.25 2.25 0 0 0 12 6c-.562 0-1.085-.216-1.453-.57.12-.337.246-.664.385-.986A8.028 8.028 0 0 0 8.095 5.12Z" />
  </svg>
);

const fileTypeLabel: Record<string, string> = {
  tsx: 'React TSX',
  html: 'HTML',
  css: 'CSS',
  png: 'PNG',
};

export const FigmaView: React.FC = () => {
  const { showToast } = useToast();

  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const [fileInput, setFileInput] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [frames, setFrames] = useState<FigmaFrameInfo[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);

  const [framePreview, setFramePreview] = useState<FigmaFramePreview | null>(null);
  const [loadingFrame, setLoadingFrame] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FigmaImportResult | null>(null);

  const [error, setError] = useState('');

  const loadStatus = async () => {
    try {
      const status = await getFigmaStatus();
      setHasToken(status.hasToken);
    } catch {
      setHasToken(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveToken = async () => {
    if (tokenInput.trim().length < 20) {
      setError('El token personal de Figma tiene más de 20 caracteres.');
      return;
    }
    setSavingToken(true);
    setError('');
    try {
      await saveFigmaToken(tokenInput.trim());
      setTokenInput('');
      await loadStatus();
      showToast('success', 'Token de Figma guardado', 'Se usará automáticamente en las siguientes operaciones.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el token.');
    } finally {
      setSavingToken(false);
    }
  };

  const handleClearToken = async () => {
    try {
      await clearFigmaToken();
      await loadStatus();
      showToast('info', 'Token eliminado');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el token.');
    }
  };

  const handleLoadFile = async () => {
    if (!fileInput.trim()) {
      setError('Pega el enlace de Figma o el File Key del archivo.');
      return;
    }
    setLoadingFile(true);
    setError('');
    setFramePreview(null);
    setImportResult(null);
    try {
      const data: FigmaPreview = await previewFigmaFile(fileInput.trim());
      setFileKey(data.fileKey);
      setFileName(data.fileName);
      setFrames(data.frames);
      if (data.frames.length === 0) {
        showToast('info', 'Sin frames', 'No se encontraron frames directos. Revisa que el archivo sea editable y compártelo.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el archivo.');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSelectFrame = async (frame: FigmaFrameInfo) => {
    setLoadingFrame(true);
    setError('');
    setImportResult(null);
    try {
      const preview: FigmaFramePreview = await previewFigmaFrame(fileKey, frame.id);
      setFramePreview(preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la vista previa.');
    } finally {
      setLoadingFrame(false);
    }
  };

  const handleImport = async () => {
    if (!framePreview) return;
    setImporting(true);
    setError('');
    try {
      const result = await importFigma(fileKey, framePreview.nodeId);
      setImportResult(result);
      showToast(
        'success',
        'Plantilla importada',
        `${result.files.length} archivos escritos en figma-imports/${result.base}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la plantilla.');
    } finally {
      setImporting(false);
    }
  };

  const inputClass =
    'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 font-mono text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50';
  const btnPrimary =
    'flex items-center gap-2 bg-emerald-600 dark:bg-emerald-500 text-white px-4 py-2 rounded-lg font-mono text-sm hover:bg-emerald-700 dark:hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const btnGhost =
    'flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <FigmaIcon className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
        <div>
          <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Figma Imports</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Importa plantillas de Figma como código en el proyecto activo
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-[10px] font-mono px-2 py-1 rounded border ${
              hasToken
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10'
                : 'text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60'
            }`}
          >
            {hasToken === null ? '…' : hasToken ? 'TOKEN CONFIGURADO' : 'SIN TOKEN'}
          </span>
        </div>
      </header>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/40 rounded-lg px-4 py-3 text-sm font-mono text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Paso a paso: cómo cargar un archivo de Figma */}
      <details className="group bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <summary className="cursor-pointer list-none flex items-center gap-2 font-mono font-bold text-sm text-zinc-800 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition select-none">
          <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          Cómo cargar un archivo de Figma (paso a paso)
          <span className="ml-auto text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <ol className="space-y-2 mt-3 text-xs font-mono text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">1</span>
            Abre el archivo de diseño en Figma (web o app de escritorio).
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">2</span>
            Asegúrate de tener acceso de <strong>edición</strong> al archivo (debe estar compartido con tu cuenta).
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">3</span>
            Haz clic <strong>derecho sobre la pestaña del archivo</strong> en la barra superior de Figma y elige <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">Copy link</span> (Copiar enlace).
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">4</span>
            Pega el enlace en el campo <strong>Archivo de Figma</strong> de la izquierda. Tiene este formato:{' '}
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-300 break-all">
              https://www.figma.com/file/FILEKEY/Nombre-del-archivo
            </span>
            <span className="block text-zinc-400 mt-1">
              El <strong>File Key</strong> es el código entre <span className="font-mono">/file/</span> y <span className="font-mono">/</span> (también puedes pegar solo ese código).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">5</span>
            Pulsa <strong>Cargar archivo</strong>: la app pedirá la lista de frames al API de Figma.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px]">6</span>
            Selecciona un <strong>frame</strong> para ver su render, y luego pulsa <strong>Importar plantilla</strong> para escribir .tsx / .html / .css / .png en <span className="font-mono">figma-imports/</span> del proyecto activo.
          </li>
        </ol>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
          Consejo: los archivos "community" o de solo lectura no se pueden importar; duplícalos a tu cuenta (File → Save as copy) para obtener permisos de edición.
        </p>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: token + archivo */}
        <div className="space-y-6">
          <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-mono font-bold text-sm text-zinc-800 dark:text-zinc-100">
              <KeyRound className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Token personal
            </h2>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="figd_xxxxxxxxxxxxxxxxxxxx"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveToken} disabled={savingToken || !tokenInput.trim()} className={btnPrimary}>
                {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Guardar token
              </button>
              {hasToken && (
                <button onClick={handleClearToken} className={btnGhost}>
                  <Trash2 className="w-4 h-4" /> Quitar
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Crea tu token en Figma → Settings → Security → Personal access tokens. Se guarda solo en la base local de
              esta app.
            </p>
          </section>

          <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-mono font-bold text-sm text-zinc-800 dark:text-zinc-100">
              <Link2 className="w-4 h-4 text-sky-500 dark:text-blue-400" /> Archivo de Figma
            </h2>
            <input
              type="text"
              value={fileInput}
              onChange={(e) => setFileInput(e.target.value)}
              placeholder="https://www.figma.com/file/FILEKEY/Nombre-o-FILEKEY"
              className={inputClass}
            />
            <button onClick={handleLoadFile} disabled={loadingFile || !fileInput.trim()} className={btnPrimary}>
              {loadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loadingFile ? 'Cargando…' : 'Cargar archivo'}
            </button>
            {fileName && (
              <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all">📁 {fileName}</p>
            )}
          </section>

          {frames.length > 0 && (
            <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-2">
              <h2 className="flex items-center gap-2 font-mono font-bold text-sm text-zinc-800 dark:text-zinc-100">
                <Layers className="w-4 h-4 text-violet-500 dark:text-violet-400" /> Frames ({frames.length})
              </h2>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {frames.map((frame, i) => (
                  <button
                    key={frame.id}
                    onClick={() => handleSelectFrame(frame)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs transition text-left ${
                      framePreview?.nodeId === frame.id
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                    }`}
                  >
                    <span className="text-zinc-400 w-6 shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">{frame.name}</span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {Math.round(frame.w)}×{Math.round(frame.h)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Columna derecha: vista previa + importar */}
        <div className="lg:col-span-2">
          <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <h2 className="font-mono font-bold text-sm text-zinc-800 dark:text-zinc-100">Vista previa renderizada</h2>
              {framePreview && (
                <span className="ml-auto text-[11px] font-mono text-zinc-500">
                  {framePreview.name} · {Math.round(framePreview.w)}×{Math.round(framePreview.h)}px
                </span>
              )}
            </div>

            {loadingFrame ? (
              <div className="flex items-center justify-center h-72 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : framePreview?.preview ? (
              <div className="flex items-start justify-center p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-auto max-h-[480px]">
                <img
                  src={framePreview.preview}
                  alt={`Vista previa de ${framePreview.name}`}
                  className="max-w-full shadow-sm rounded"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-72 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-center px-6">
                <FigmaIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
                  Carga un archivo y selecciona un frame para ver su render.
                </p>
                {framePreview && !framePreview.preview && (
                  <p className="text-xs text-zinc-400 mt-2">El frame no pudo exportarse como imagen (best-effort).</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <button onClick={handleImport} disabled={importing || !framePreview} className={btnPrimary}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importing ? 'Importando…' : 'Importar plantilla'}
              </button>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Escribe .tsx, .html, .css y .png en <span className="font-mono">figma-imports/</span> del proyecto activo.
              </p>
            </div>

            {importResult && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/40 rounded-lg p-4 space-y-2">
                <p className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ Importado en {importResult.dir}
                </p>
                <ul className="space-y-1">
                  {importResult.files.map((f) => (
                    <li key={f.path} className="flex items-center gap-2 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="text-zinc-400">▸</span>
                      <span className="truncate">{f.path.replace(importResult.dir, '')}</span>
                      <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300">
                        {fileTypeLabel[f.type] ?? f.type}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {importResult.stats.nodes} nodos · {importResult.stats.textNodes} textos · {importResult.stats.images}{' '}
                  imágenes · {importResult.stats.frames} frame
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};