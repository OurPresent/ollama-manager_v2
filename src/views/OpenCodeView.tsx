import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Circle,
  Database,
  FileText,
  History,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Save,
  Send,
  Server,
  Sliders,
  Square,
  Terminal,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import { useOpenCodeStore } from '../store/opencodeStore';
import type { OllamaModel, OpenCodeConfigFile, OpenCodeQuery, OpenCodeSettings, ProjectInfo } from '../types';
import {
  applyOllamaToOpenCode,
  getOpenCodeSettings,
  getOpenCodePermissions,
  listOpenCodeQueries,
  readOpenCodeConfigFile,
  saveOpenCodePermissions,
  saveOpenCodeSettings,
  writeOpenCodeConfigFile,
  type OpenCodePermissions,
} from '../services/opencode';
import { fetchInstalledModels, getOllamaBaseUrl } from '../services/ollama';
import { useToast } from '../components/Toast';

interface Props {
  projectInfo: ProjectInfo;
}

type Tab = 'chat' | 'sessions' | 'history' | 'config';

export const OpenCodeView: React.FC<Props> = ({ projectInfo }) => {
  const {
    status,
    loading,
    sending,
    error,
    sessions,
    currentSessionId,
    chatMessages,
    providers,
    agents,
    commands,
    defaultModel,
    loadStatus,
    start,
    stop,
    loadCatalog,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    send,
    command,
    abort,
    setError,
  } = useOpenCodeStore();

  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [model, setModel] = useState('');
  const [agent, setAgent] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<OpenCodeSettings>({ port: 4096, hostname: '127.0.0.1', password: '', autoStart: false });
  const [settingsMsg, setSettingsMsg] = useState('');
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [configFile, setConfigFile] = useState<OpenCodeConfigFile | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');
  const [queries, setQueries] = useState<OpenCodeQuery[]>([]);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedOllamaModels, setSelectedOllamaModels] = useState<string[]>([]);
  const [ocDefaultModel, setOcDefaultModel] = useState('');
  const [perms, setPerms] = useState<OpenCodePermissions>({
    autoApprove: false,
    read: 'ask',
    edit: 'ask',
    bash: 'ask',
    webfetch: 'ask',
    websearch: 'ask',
  });
  const [permsMsg, setPermsMsg] = useState('');
  const [permsBusy, setPermsBusy] = useState(false);
  const { showToast } = useToast();

  const messages = chatMessages[currentSessionId ?? ''] ?? [];

  // ---- Datos iniciales ----
  useEffect(() => {
    (async () => {
      const st = await loadStatus();
      if (st?.running) {
        await Promise.all([loadCatalog(), loadSessions()]);
      }
      try {
        const s = await getOpenCodeSettings();
        setSettingsDraft(s);
      } catch {
        // ignore
      }
      try {
        setOllamaUrl(await getOllamaBaseUrl());
        const models = await fetchInstalledModels();
        setOllamaModels(models);
        setSelectedOllamaModels(models.map((m) => m.name));
        setOcDefaultModel(models[0]?.name ?? '');
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'history') loadQueries();
    if (tab === 'config') {
      loadConfigFile();
      loadPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, scope]);

  const refresh = async () => {
    setError(null);
    const st = await loadStatus();
    if (st?.running) {
      await Promise.all([loadCatalog(), loadSessions()]);
    }
  };

  const loadQueries = useCallback(async () => {
    try {
      setQueries(await listOpenCodeQueries(projectInfo.id));
    } catch {
      setQueries([]);
    }
  }, [projectInfo.id]);

  const loadConfigFile = useCallback(async () => {
    setConfigMsg('');
    setConfigError('');
    try {
      const cf = await readOpenCodeConfigFile(scope);
      setConfigFile(cf);
      setConfigContent(cf.content);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'No se pudo leer la configuración');
    }
  }, [scope]);

  const saveConfig = async () => {
    setConfigMsg('');
    setConfigError('');
    try {
      JSON.parse(configContent);
    } catch {
      setConfigError('JSON inválido. Revisa la sintaxis antes de guardar.');
      return;
    }
    try {
      const cf = await writeOpenCodeConfigFile(scope, configContent);
      setConfigFile(cf);
      setConfigMsg('Archivo guardado correctamente.');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const saveSettings = async () => {
    try {
      await saveOpenCodeSettings(settingsDraft);
      setSettingsMsg('Ajustes guardados. Aplica al reiniciar el servidor.');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch (e) {
      setSettingsMsg(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const applyOllama = async () => {
    setConfigMsg('');
    setConfigError('');
    try {
      const cf = await applyOllamaToOpenCode(scope, {
        ollamaUrl,
        models: selectedOllamaModels,
        model: ocDefaultModel || undefined,
      });
      setConfigFile(cf);
      setConfigContent(cf.content);
      setConfigMsg('Provider de Ollama aplicado al archivo de configuración.');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Error al aplicar provider');
    }
  };

  const loadPermissions = async () => {
    setPermsMsg('');
    try {
      setPerms(await getOpenCodePermissions(scope));
    } catch (e) {
      setPermsMsg(e instanceof Error ? e.message : 'No se pudieron cargar los permisos');
    }
  };

  const savePermissions = async () => {
    setPermsBusy(true);
    setPermsMsg('');
    try {
      const cf = await saveOpenCodePermissions(scope, perms);
      setConfigFile(cf);
      setConfigContent(cf.content);
      setPermsMsg('Permisos guardados en el archivo de configuración.');
      showToast('success', 'Permisos guardados', `Auto-aprobación ${perms.autoApprove ? 'activada' : 'desactivada'} (${scope === 'project' ? 'proyecto' : 'global'})`);
      setTimeout(() => setPermsMsg(''), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar permisos';
      setPermsMsg(msg);
      showToast('error', 'Error al guardar permisos', msg);
    } finally {
      setPermsBusy(false);
    }
  };

  // ---- Opciones derivadas ----
  const modelOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const p of providers) {
      const models = p.models;
      const entries: Array<[string, { id?: string }]> = Array.isArray(models)
        ? models.map((m) => [m.id, m])
        : models && typeof models === 'object'
          ? Object.entries(models as Record<string, { id?: string }>)
          : [];
      for (const [id, m] of entries) {
        const modelId = m?.id ?? id;
        const value = `${p.id}/${modelId}`;
        out.push({ value, label: value });
      }
    }
    return out;
  }, [providers]);

  const effectiveModel = model || defaultModel;

  const commandMatches = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const q = input.slice(1).toLowerCase();
    return commands.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [input, commands]);

  // ---- Acciones de chat ----
  const handleNewSession = async () => {
    const s = await createSession('Nuevo Chat OpenCode', projectInfo.id);
    if (s) setTab('chat');
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('¿Eliminar esta sesión de OpenCode?')) return;
    await deleteSession(sessionId);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    let sid = currentSessionId;
    if (!sid) {
      const s = await createSession(trimmed.slice(0, 40), projectInfo.id);
      if (!s) return;
      sid = s.id;
    }

    setInput('');
    const opts = { model: effectiveModel || undefined, agent: agent || undefined, projectId: projectInfo.id, title: trimmed.slice(0, 40) };

    const slashMatch = trimmed.match(/^\/([\w-]+)(?:\s+(.*))?$/);
    if (slashMatch && commands.some((c) => c.name === slashMatch[1])) {
      await command(sid, slashMatch[1], slashMatch[2] ?? '', opts);
    } else {
      await send(sid, trimmed, opts);
    }
  };

  const handleAbort = async () => {
    if (!currentSessionId) return;
    await abort(currentSessionId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Terminal className="w-5 h-5 text-amber-500 dark:text-emerald-400" /> OpenCode — Servidor Headless
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Chat con los agentes de OpenCode usando tus modelos de Ollama. Sesiones y consultas persistidas por proyecto.
        </p>
      </header>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-xl px-4 py-3 font-mono text-xs text-rose-600 dark:text-rose-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-rose-800 dark:hover:text-rose-300">✕</button>
        </div>
      )}

      {/* ---- Estado del servidor ---- */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Circle className={`w-3 h-3 fill-current ${status?.running ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`} />
          <span className={`font-bold ${status?.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {status?.running ? 'SERVIDOR ACTIVO' : 'SERVIDOR DETENIDO'}
          </span>
          {status?.running && (
            <span className="text-zinc-500 dark:text-zinc-400">
              {status.external ? 'modo externo (detectado)' : 'gestionado por la app'}
              {status.pid ? ` · PID ${status.pid}` : ''} · puerto {status.port}
              {status.version ? ` · v${status.version}` : ''}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refrescar
          </button>
          {status?.running ? (
            status.managed && (
              <button
                onClick={async () => {
                  await stop();
                  setTab('chat');
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />} Detener
              </button>
            )
          ) : (
            <button
              onClick={() => start(projectInfo.path || undefined)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />} Iniciar servidor
            </button>
          )}
        </div>
        {status?.logTail && status.logTail.length > 0 && (
          <details>
            <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              Últimas líneas del log ({status.logTail.length})
            </summary>
            <pre className="mt-2 max-h-40 overflow-y-auto bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-400 text-[10px] whitespace-pre-wrap">
              {status.logTail.join('\n')}
            </pre>
          </details>
        )}
      </div>

      {/* ---- Tabs ---- */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        {(
          [
            { id: 'chat', label: 'Chat', icon: <Terminal className="w-3.5 h-3.5" /> },
            { id: 'sessions', label: `Sesiones (${sessions.length})`, icon: <Database className="w-3.5 h-3.5" /> },
            { id: 'history', label: `Historial (${queries.length})`, icon: <History className="w-3.5 h-3.5" /> },
            { id: 'config', label: 'Configuración', icon: <Sliders className="w-3.5 h-3.5" /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
              tab === t.id
                ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ---- CHAT ---- */}
      {tab === 'chat' && (
        <div className="space-y-4">
          {!status?.running ? (
            <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center font-mono text-sm space-y-3">
              <Terminal className="w-8 h-8 mx-auto text-zinc-400" />
              <p className="text-zinc-500 dark:text-zinc-400">El servidor headless de OpenCode está detenido.</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Pulsa "Iniciar servidor" para poder chatear con los agentes de OpenCode usando tus modelos de Ollama.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <button
                  onClick={handleNewSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva sesión
                </button>
                <select
                  value={currentSessionId ?? ''}
                  onChange={(e) => selectSession(e.target.value || null)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 max-w-xs"
                >
                  <option value="">Selecciona una sesión</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || s.id}
                    </option>
                  ))}
                </select>
                <select
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                >
                  <option value="">Agente por defecto</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.id}
                    </option>
                  ))}
                </select>
                <select
                  value={effectiveModel}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                >
                  {modelOptions.length === 0 && <option value="">Sin modelos configurados</option>}
                  {modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {sending && (
                  <button
                    onClick={handleAbort}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    <Square className="w-3.5 h-3.5" /> Abortar
                  </button>
                )}
                {currentSessionId && (
                  <button
                    onClick={() => handleDeleteSession(currentSessionId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mensajes */}
              <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 max-h-[480px] overflow-y-auto">
                {messages.length === 0 && (
                  <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 text-center py-10">
                    Sin mensajes. Escribe algo para comenzar, o usa un comando con <span className="text-emerald-600 dark:text-emerald-400">/</span>
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 font-mono text-xs space-y-2 border ${
                        m.role === 'user'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        {m.role === 'user' ? 'Tú' : 'OpenCode'}
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-zinc-700 dark:text-zinc-300">{m.content}</pre>
                      {m.toolSummaries && m.toolSummaries.length > 0 && (
                        <div className="space-y-1 border-t border-zinc-200 dark:border-zinc-700 pt-2">
                          {m.toolSummaries.map((t, i) => (
                            <p key={i} className="text-[10px] text-sky-600 dark:text-blue-400">
                              <Wrench className="w-3 h-3 inline mr-1" />
                              {t.tool} · {t.state}: {t.summary}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> OpenCode está trabajando...
                  </div>
                )}
              </div>

              {/* Comandos disponibles */}
              {commands.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider px-1 self-center">Comandos:</span>
                  {commands.slice(0, 10).map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setInput(`/${c.name} `)}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
                      title={c.description}
                    >
                      /{c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="relative">
                {commandMatches.length > 0 && (
                  <div className="absolute bottom-full mb-1 left-0 w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden z-10">
                    {commandMatches.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setInput(`/${c.name} `)}
                        className="w-full text-left px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2"
                      >
                        <ChevronDown className="w-3 h-3 text-zinc-400" /> /{c.name}
                        {c.description && <span className="text-[10px] text-zinc-400 truncate">{c.description}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe un mensaje o /comando..."
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-mono text-xs hover:bg-emerald-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- SESIONES ---- */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">No hay sesiones de OpenCode guardadas.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      selectSession(s.id);
                      setTab('chat');
                    }}
                    className="font-bold text-amber-600 dark:text-emerald-400 hover:underline truncate"
                  >
                    {s.title || s.id}
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="text-zinc-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className="text-zinc-400">id: {s.id.slice(0, 12)}…</span>
                  {s.agent && <span>agente: {s.agent}</span>}
                  {s.model && (
                    <span>modelo: {typeof s.model === 'string' ? s.model : s.model.id ?? 'desconocido'}</span>
                  )}
                  {s.time?.created && <span>creada: {new Date(s.time.created).toLocaleString()}</span>}
                  {s.time?.updated && <span>actualizada: {new Date(s.time.updated).toLocaleString()}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ---- HISTORIAL ---- */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Consultas persistidas en SQLite para "{projectInfo.name}" (sesiones de OpenCode).
            </p>
            <button
              onClick={loadQueries}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition font-mono text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recargar
            </button>
          </div>
          {queries.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay consultas OpenCode registradas para este proyecto.</p>
          ) : (
            queries.map((q) => (
              <details key={q.id} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <summary className="cursor-pointer font-bold text-sky-600 dark:text-blue-400 flex justify-between items-center">
                  <span>❯ {q.title}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{new Date(q.createdAt).toLocaleString()}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div>
                    <p className="text-zinc-400 uppercase tracking-wider text-[10px] mb-1">Consulta</p>
                    <pre className="bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-300 whitespace-pre-wrap">{q.rawQuery}</pre>
                  </div>
                  {q.optimizedQuery && (
                    <div>
                      <p className="text-zinc-400 uppercase tracking-wider text-[10px] mb-1">Respuesta (resumen)</p>
                      <pre className="bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-emerald-400 whitespace-pre-wrap">{q.optimizedQuery}</pre>
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-400">modelo: {q.model} · agente: {q.agent}</p>
                </div>
              </details>
            ))
          )}
        </div>
      )}

      {/* ---- CONFIGURACIÓN ---- */}
      {tab === 'config' && (
        <div className="space-y-6">
          {/* Ajustes del servidor */}
          <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-3">
            <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Ajustes del servidor OpenCode
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400">Puerto</label>
                <input
                  type="number"
                  value={settingsDraft.port}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, port: Number(e.target.value) || 4096 })}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400">Hostname</label>
                <input
                  type="text"
                  value={settingsDraft.hostname}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, hostname: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400">Password (auth Basic opcional)</label>
                <input
                  type="password"
                  value={settingsDraft.password}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, password: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.autoStart}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, autoStart: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">Auto-arranque al abrir la app</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
              >
                <Save className="w-3.5 h-3.5" /> Guardar ajustes
              </button>
              {settingsMsg && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{settingsMsg}</span>}
            </div>
          </div>

          {/* Provider Ollama */}
          <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-3">
            <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Conectar Ollama como provider
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400">
              Añade los modelos instalados en Ollama al <span className="text-emerald-600 dark:text-emerald-400">opencode.json</span> con el formato <span className="text-sky-600 dark:text-blue-400">ollama/&lt;modelo&gt;</span>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-64 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                placeholder="http://localhost:11434"
              />
              <select
                value={ocDefaultModel}
                onChange={(e) => setOcDefaultModel(e.target.value)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
              >
                <option value="">Modelo por defecto (opcional)</option>
                {ollamaModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'project' | 'global')}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
              >
                <option value="project">Proyecto</option>
                <option value="global">Global</option>
              </select>
              <button
                onClick={applyOllama}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
              >
                <Bot className="w-3.5 h-3.5" /> Aplicar provider
              </button>
            </div>
            {ollamaModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-zinc-400 self-center">Modelos detectados:</span>
                {ollamaModels.map((m) => (
                  <label key={m.name} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOllamaModels.includes(m.name)}
                      onChange={(e) =>
                        setSelectedOllamaModels((prev) =>
                          e.target.checked ? [...prev, m.name] : prev.filter((x) => x !== m.name)
                        )
                      }
                      className="accent-emerald-500"
                    />
                    <span className="text-[10px] text-zinc-700 dark:text-zinc-300">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Archivo de configuración */}
          <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500 dark:text-emerald-400" /> Archivo de configuración
              </h3>
              <div className="flex-1" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setScope('project')}
                  className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] transition ${
                    scope === 'project'
                      ? 'bg-amber-50 dark:bg-emerald-500/10 border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  Proyecto
                </button>
                <button
                  onClick={() => setScope('global')}
                  className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] transition ${
                    scope === 'global'
                      ? 'bg-amber-50 dark:bg-emerald-500/10 border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  Global
                </button>
              </div>
            </div>

            {configFile && (
              <p className="text-[10px] text-zinc-400 break-all">
                {configFile.path} {configFile.exists ? '' : '(no existe, se creará al guardar)'}
              </p>
            )}

            <textarea
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              spellCheck={false}
              rows={18}
              className="w-full bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-3 font-mono text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 whitespace-pre overflow-x-auto resize-y"
              placeholder="{ /* opencode.json */ }"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={saveConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
              >
                <Save className="w-3.5 h-3.5" /> Guardar configuración
              </button>
              <button
                onClick={loadConfigFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recargar
              </button>
              {configMsg && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{configMsg}</span>}
              {configError && <span className="text-[10px] text-rose-500">{configError}</span>}
            </div>
          </div>

          {/* Auto-aprobaciones */}
          <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500 dark:text-emerald-400" /> Auto-aprobaciones
              </h3>
              <span className="text-[10px] text-zinc-400">
                Controla qué acciones ejecuta OpenCode sin pedir confirmación
              </span>
              <div className="flex-1" />
              <span className="text-[10px] text-zinc-400">
                Scope: <strong>{scope === 'project' ? 'Proyecto' : 'Global'}</strong>
              </span>
            </div>

            <div className="flex items-center justify-between bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 rounded-lg px-4 py-3">
              <div>
                <p className="font-bold text-amber-800 dark:text-emerald-200">Modo auto-aprobación (master)</p>
                <p className="text-[10px] text-amber-700/80 dark:text-emerald-300/70 mt-0.5">
                  Con el toggle activo, OpenCode ejecuta lecturas, ediciones, comandos y búsquedas web sin pedir permiso.
                </p>
              </div>
              <button
                onClick={() => setPerms((p) => ({ ...p, autoApprove: !p.autoApprove }))}
                title={perms.autoApprove ? 'Desactivar auto-aprobación' : 'Activar auto-aprobación'}
                className={`relative w-12 h-6 rounded-full transition ${perms.autoApprove ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${perms.autoApprove ? 'translate-x-6' : ''}`}
                />
              </button>
            </div>

            {!perms.autoApprove && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(
                  [
                    ['read', 'Lectura de archivos'],
                    ['edit', 'Edición de archivos'],
                    ['bash', 'Comandos en terminal'],
                    ['webfetch', 'Navegador / webfetch'],
                    ['websearch', 'Búsquedas web'],
                  ] as Array<[keyof Omit<OpenCodePermissions, 'autoApprove'>, string]>
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5">
                    <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
                    <select
                      value={perms[key]}
                      onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.value as OpenCodePermissions[keyof Omit<OpenCodePermissions, 'autoApprove'>] }))}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                    >
                      <option value="allow">allow</option>
                      <option value="ask">ask</option>
                      <option value="deny">deny</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={savePermissions}
                disabled={permsBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {permsBusy ? 'Guardando...' : 'Guardar permisos'}
              </button>
              {permsMsg && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{permsMsg}</span>}
              <span className="text-[10px] text-zinc-400">
                Docs:{' '}
                <a href="https://opencode.ai/docs/permissions/" target="_blank" rel="noreferrer" className="text-sky-600 dark:text-blue-400 underline">
                  opencode.ai/docs/permissions
                </a>
              </span>
            </div>
          </div>

          {/* Providers conectados */}
          {status?.running && (
            <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200">Providers configurados ({providers.length})</h3>
              {providers.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400">Sin providers. Conecta Ollama desde la sección anterior o edita el archivo.</p>
              ) : (
                providers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <Circle className="w-2 h-2 fill-current text-emerald-500" /> {p.id}
                    {p.npm && <span className="text-zinc-400">· {p.npm}</span>}
                    <span className="text-zinc-400">
                      ·{' '}
                      {Array.isArray(p.models)
                        ? `${p.models.length} modelos`
                        : p.models && typeof p.models === 'object'
                          ? `${Object.keys(p.models).length} modelos`
                          : 'sin modelos'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpenCodeView;
