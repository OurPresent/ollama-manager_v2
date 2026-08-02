import React, { useState, useEffect, useCallback } from 'react';
import { History, Share2, FileText, Terminal, ShieldCheck, Command } from 'lucide-react';
import type { GraphNodeDto, TaskLogDto, ProjectQueryDto } from '../types/dto';
import { fetchGraphNodes, fetchTaskLogs, fetchProjectQueries, fetchAuditEvents, fetchSystemLogs, AuditEventDto, SystemLogDto } from '../services/apiDb';
import type { OpenCodeQuery } from '../types';
import { listOpenCodeQueries } from '../services/opencode';

interface Props {
  projectInfo: { name: string; path: string; id?: string };
}

type Tab = 'nodes' | 'logs' | 'queries' | 'ocQueries' | 'audit';

export const HistoryView: React.FC<Props> = ({ projectInfo }) => {
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [nodes, setNodes] = useState<GraphNodeDto[]>([]);
  const [logs, setLogs] = useState<TaskLogDto[]>([]);
  const [queries, setQueries] = useState<ProjectQueryDto[]>([]);
  const [ocQueries, setOcQueries] = useState<OpenCodeQuery[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nodeList, logList, queryList, eventList, sysLogs, ocList] = await Promise.all([
        fetchGraphNodes(projectInfo.name),
        fetchTaskLogs(projectInfo.name),
        fetchProjectQueries(projectInfo.name),
        fetchAuditEvents(),
        fetchSystemLogs(),
        listOpenCodeQueries(projectInfo.id),
      ]);
      setNodes(nodeList);
      setLogs(logList);
      setQueries(queryList);
      setOcQueries(ocList);
      setAuditEvents(eventList);
      setSystemLogs(sysLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [projectInfo.name, projectInfo.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <History className="w-5 h-5 text-amber-500 dark:text-emerald-400" /> Memoria Persistente (Grafo, MD & Consultas)
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Inspección de la base de conocimiento registrada para "{projectInfo.name}"</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'nodes'
              ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" /> Nodos del Grafo ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'logs'
              ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Bitácoras Markdown ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('queries')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'queries'
              ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Consultas ({queries.length})
        </button>
        <button
          onClick={() => setActiveTab('ocQueries')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'ocQueries'
              ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <Command className="w-3.5 h-3.5" /> OpenCode ({ocQueries.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'audit'
              ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Auditoría ({auditEvents.length + systemLogs.length})
        </button>
      </div>

      {loading && (
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">Cargando historial desde SQLite...</p>
      )}
      {error && <p className="font-mono text-xs text-rose-500">{error}</p>}

      {/* Contenido */}
      {!loading && !error && activeTab === 'nodes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay nodos registrados en el grafo.</p>
          ) : (
            nodes.map((n) => (
              <div key={n.id} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-amber-600 dark:text-emerald-400 font-bold">{n.title}</span>
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-500 dark:text-zinc-400">{n.nodeType}</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{n.content}</p>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block text-right">{new Date(n.updatedAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'logs' && (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay bitácoras guardadas.</p>
          ) : (
            logs.map((log) => (
              <details key={log.taskId} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <summary className="cursor-pointer font-bold text-amber-600 dark:text-emerald-400 flex justify-between items-center">
                  <span>📌 {log.taskId}: {log.title}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-sans whitespace-pre-wrap">
                  {log.markdownContent}
                </div>
              </details>
            ))
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'queries' && (
        <div className="space-y-4">
          {queries.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay consultas registradas.</p>
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
                      <p className="text-zinc-400 uppercase tracking-wider text-[10px] mb-1">Optimizada</p>
                      <pre className="bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-emerald-400 whitespace-pre-wrap">{q.optimizedQuery}</pre>
                    </div>
                  )}
                  {q.executionTimeMs != null && (
                    <p className="text-[10px] text-zinc-400">Tiempo de ejecución: {q.executionTimeMs} ms</p>
                  )}
                </div>
              </details>
            ))
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'ocQueries' && (
        <div className="space-y-4">
          {ocQueries.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
              No hay consultas OpenCode registradas para este proyecto.
            </p>
          ) : (
            ocQueries.map((q) => (
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

      {!loading && !error && activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200 mb-2">Eventos de Auditoría</h3>
            {auditEvents.length === 0 ? (
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay eventos de auditoría.</p>
            ) : (
              <div className="space-y-2">
                {auditEvents.map((ev) => (
                  <div key={ev.id} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-amber-600 dark:text-emerald-400 font-bold">{ev.eventType}</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{new Date(ev.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                      {ev.entityType} · {ev.entityId}
                      {ev.projectId ? ` · proyecto: ${ev.projectId}` : ''}
                    </p>
                    {Object.keys(ev.details).length > 0 && (
                      <pre className="mt-1 bg-zinc-950 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-zinc-400 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(ev.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200 mb-2">Logs del Sistema</h3>
            {systemLogs.length === 0 ? (
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">No hay logs del sistema.</p>
            ) : (
              <div className="space-y-2">
                {systemLogs.map((log) => (
                  <div key={log.id} className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <span className={`font-bold ${
                        log.level === 'error' ? 'text-rose-500' : log.level === 'warn' ? 'text-amber-500' : 'text-sky-600 dark:text-blue-400'
                      }`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 mt-1">
                      <span className="text-zinc-400">{log.source}:</span> {log.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
