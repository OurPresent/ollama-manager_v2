import React, { useEffect, useState } from 'react';
import { Database, Server, KeyRound, Globe, RefreshCw, Box, Sparkles, Plug, ExternalLink, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { fetchIntegrations, fetchIntegrationGuide, redetectIntegration, Integration } from '../services/integrations';

const categoryIcon: Record<string, React.ReactNode> = {
  'base-datos': <Database className="w-5 h-5" />,
  backend: <Server className="w-5 h-5" />,
  auth: <KeyRound className="w-5 h-5" />,
  browser: <Globe className="w-5 h-5" />,
  queue: <RefreshCw className="w-5 h-5" />,
  devops: <Box className="w-5 h-5" />,
  ai: <Sparkles className="w-5 h-5" />,
};

export const IntegracionesView: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [summary, setSummary] = useState<{ total: number; detected: number; categories: string[] }>({ total: 0, detected: 0, categories: [] });
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<string>('');
  const [guideTitle, setGuideTitle] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchIntegrations();
      setIntegrations(data.integrations);
      setSummary(data.summary);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRedetect = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await redetectIntegration(id);
      setIntegrations((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleGuide = async (integration: Integration) => {
    setGuideTitle(integration.name);
    setShowGuide(true);
    setGuide('');
    try {
      setGuide(await fetchIntegrationGuide(integration.id));
    } catch {
      setGuide('No se pudo cargar la guía.');
    }
  };

  const copyEnv = async (integration: Integration) => {
    const content = integration.envVars
      .map((e) => `${e.key}="${e.hint}"`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(content || `# ${integration.name} no define variables de entorno`);
      setCopied(integration.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Plug className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Integraciones</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Ecosistema local de herramientas y servicios para tus proyectos
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-detectar todas
        </button>
      </header>

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Integraciones</p>
            <p className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">{summary.total}</p>
          </div>
          <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Detectadas en tu equipo</p>
            <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">{summary.detected}</p>
          </div>
          <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Categorías</p>
            <p className="text-sm font-mono font-bold text-sky-600 dark:text-blue-400">{summary.categories.join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
              </div>
            ))
          : integrations.map((integration) => (
              <div
                key={integration.id}
                className={`bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 hover:border-emerald-300 dark:hover:border-zinc-700 transition ${integration.detected ? '' : 'opacity-90'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${integration.detected ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                      <span className={integration.detected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}>
                        {categoryIcon[integration.category] ?? <Plug className="w-5 h-5" />}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-zinc-800 dark:text-zinc-100">{integration.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        {integration.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {integration.detected ? (
                      <span className="text-emerald-600 dark:text-emerald-400" title="Detectada">
                        <CheckCircle2 className="w-5 h-5" />
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500" title="No detectada">
                        <XCircle className="w-5 h-5" />
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{integration.description}</p>

                {integration.detected ? (
                  <div className="flex flex-wrap gap-1.5">
                    {integration.detectedVia.map((v, i) => (
                      <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {v}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    No detectada — instala sus herramientas o la librería npm
                  </p>
                )}

                {integration.envVars.length > 0 && (
                  <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-1">
                    {integration.envVars.map((env) => (
                      <p key={env.key} className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                        <strong className="text-sky-600 dark:text-blue-400">{env.key}</strong> {env.hint}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleGuide(integration)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 px-3 py-2 rounded-lg font-mono text-xs transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver guía
                  </button>
                  {integration.envVars.length > 0 && (
                    <button
                      onClick={() => copyEnv(integration)}
                      className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
                      title="Copiar variables de entorno al portapapeles"
                    >
                      {copied === integration.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleRedetect(integration.id)}
                    disabled={busyId === integration.id}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition disabled:opacity-50"
                    title="Re-detectar"
                  >
                    {busyId === integration.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
      </div>

      {showGuide && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100">{guideTitle}</h2>
              <button
                onClick={() => setShowGuide(false)}
                className="text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl"
              >
                ×
              </button>
            </div>
            <pre className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
              {guide || 'Cargando guía...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
