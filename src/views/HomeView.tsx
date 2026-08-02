import React, { useEffect, useState } from 'react';
import { OllamaModel, PersistedAgent, ActiveView } from '../types';
import { MetricCard } from '../components/MetricCard';
import { getRunningModels } from '../services/ollama';
import { fetchModelUsage, fetchSystemStats } from '../services/systemApi';
import type { ModelUsageDto, RunningModelDto, SystemStatsDto } from '../types/dto';
import {
  Cpu,
  Terminal,
  ArrowRight,
  MessageSquare,
  Bot,
  Box,
  Play,
  MemoryStick,
  Activity,
  Gauge,
} from 'lucide-react';

interface Props {
  isOllamaOnline: boolean;
  models: OllamaModel[];
  agents: PersistedAgent[];
  setActiveView: (view: ActiveView) => void;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export const HomeView: React.FC<Props> = ({ isOllamaOnline, models, agents, setActiveView }) => {
  const [systemStats, setSystemStats] = useState<SystemStatsDto | null>(null);
  const [modelUsage, setModelUsage] = useState<ModelUsageDto[]>([]);
  const [runningModels, setRunningModels] = useState<RunningModelDto[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const [stats, usage, running] = await Promise.all([
        fetchSystemStats(),
        fetchModelUsage(),
        getRunningModels(),
      ]);
      if (cancelled) return;
      if (stats) setSystemStats(stats);
      setModelUsage(usage);
      setRunningModels(running);
    };

    refresh();
    const interval = setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeAgentCount = agents.filter((a) => a.isActive !== false).length;
  const usedRamPct = systemStats?.usedPct ?? 0;
  const memBarColor = usedRamPct > 85 ? 'bg-rose-500' : usedRamPct > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  const maxMemSize = runningModels.length > 0 ? Math.max(...runningModels.map((m) => m.size)) : 1;
  const maxUsageTotal =
    modelUsage.length > 0
      ? Math.max(...modelUsage.map((m) => m.sessions + m.messages + m.agentRuns))
      : 1;
  const sortedRunningModels = [...runningModels].sort((a, b) => b.size - a.size);
  const maxRunningModel = sortedRunningModels.length > 0 ? sortedRunningModels[0] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-2xl font-mono font-bold tracking-tight text-zinc-800 dark:text-zinc-100">🚀 LLMX v2 — Control Center Local</h1>
        <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
          Orquestación local de Modelos, Agentes y Grafos de Memoria
        </p>
      </header>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Modelos Instalados" value={models.length} subtext="En servidor Ollama" accentColor="green" />
        <MetricCard
          label="Agentes Disponibles"
          value={`${activeAgentCount} / ${agents.length}`}
          subtext={agents.length === 0 ? 'Sin agentes registrados' : 'Activos / total (por proyecto)'}
          accentColor="amber"
        />
        <MetricCard
          label="RAM en Uso"
          value={systemStats ? formatBytes(systemStats.usedRam) : '—'}
          subtext={systemStats ? `${systemStats.usedPct.toFixed(1)}% de ${formatBytes(systemStats.totalRam)}` : 'Consultando sistema...'}
          accentColor="sky"
        />
        <MetricCard
          label="Estado Servidor"
          value={isOllamaOnline ? 'ONLINE' : 'OFFLINE'}
          subtext="http://localhost:11434"
          accentColor={isOllamaOnline ? 'green' : 'rose'}
        />
      </div>

      {/* Dashboard de Consumo */}
      <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-500 dark:text-blue-400" />
          Dashboard de Consumo Real
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">RAM Total</p>
            <p className="text-lg font-mono font-bold text-zinc-800 dark:text-zinc-100 mt-1">
              {systemStats ? formatBytes(systemStats.totalRam) : '—'}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">RAM Libre</p>
            <p className="text-lg font-mono font-bold text-zinc-800 dark:text-zinc-100 mt-1">
              {systemStats ? formatBytes(systemStats.freeRam) : '—'}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Modelos en Memoria</p>
            <p className="text-lg font-mono font-bold text-zinc-800 dark:text-zinc-100 mt-1">{runningModels.length}</p>
            <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500">Cargados ahora en Ollama</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">RAM Proceso Ollama</p>
            <p className="text-lg font-mono font-bold text-sky-600 dark:text-blue-400 mt-1">
              {systemStats ? formatBytes(systemStats.ollamaRam) : '—'}
            </p>
          </div>
        </div>

        {systemStats && systemStats.totalRam > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                RAM en uso: {formatBytes(systemStats.usedRam)} de {formatBytes(systemStats.totalRam)}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                {systemStats.usedPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full ${memBarColor} transition-all duration-700`}
                style={{ width: `${Math.min(systemStats.usedPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Consumo por modelo en memoria */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
            <p className="text-xs font-mono font-semibold text-sky-600 dark:text-blue-400 flex items-center gap-2">
              <MemoryStick className="w-4 h-4" /> Consumo por Modelo en Memoria
            </p>
            {runningModels.length === 0 ? (
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-500">
                Ningún modelo cargado. Usa un modelo en Chat/Planes o cárgalo en la vista Ollama para ver su consumo real.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedRunningModels.map((m) => (
                  <div key={m.name}>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-zinc-700 dark:text-zinc-200 truncate">{m.name}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{formatBytes(m.size)}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-sky-500 dark:bg-blue-400 transition-all duration-700"
                        style={{ width: `${Math.max((m.size / maxMemSize) * 100, 4)}%` }}
                      />
                    </div>
                    <div className="flex gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">
                      <span>VRAM: {formatBytes(m.sizeVram)}</span>
                      <span>Contexto: {m.contextLength ?? '—'}</span>
                      {maxRunningModel && m.name === maxRunningModel.name && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">▲ mayor consumo</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Uso histórico por modelo */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
            <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Uso Histórico por Modelo
            </p>
            {modelUsage.length === 0 ? (
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-500">
                Aún no hay uso registrado. Los chats y los pipelines de agentes se contabilizan por modelo desde SQLite.
              </p>
            ) : (
              <div className="space-y-3">
                {modelUsage.map((m) => {
                  const total = m.sessions + m.messages + m.agentRuns;
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-zinc-700 dark:text-zinc-200 truncate">{m.model}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {m.sessions} sesiones · {m.messages} msgs · {m.agentRuns} corridas
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-700"
                          style={{ width: `${Math.max((total / maxUsageTotal) * 100, 4)}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">
                        {modelUsage[0].model === m.model ? '▲ más utilizado' : `${total} interacciones`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Instrucciones de Uso */}
      <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          Guía Rápida de Uso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="space-y-2">
            <p><span className="text-emerald-600 dark:text-emerald-400">1.</span> <span className="text-zinc-700 dark:text-zinc-300">Chat del Proyecto:</span> Consulta tu código con IA. Se inyecta el contexto estructural del proyecto y las referencias <span className="text-sky-600 dark:text-blue-400">$archivo</span> se resuelven con el contenido real.</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">2.</span> <span className="text-zinc-700 dark:text-zinc-300">Gestor de Agentes:</span> Crea agentes, asígnales un modelo propio y actívalos/desactívalos con el switch. Cada proyecto puede habilitar distintos agentes según sus funcionalidades.</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">3.</span> <span className="text-zinc-700 dark:text-zinc-300">Planes:</span> Define un objetivo, genera el plan con IA, selecciona los agentes que participarán y ordénalos. Cada agente levanta su LLM asignado en Ollama y lo detiene al terminar si no es el modelo global.</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">4.</span> <span className="text-zinc-700 dark:text-zinc-300">Gestor Ollama:</span> Inicia/detén el servicio, ejecuta o detiene modelos en memoria, descarga nuevos y libera RAM.</p>
          </div>
          <div className="space-y-2">
            <p><span className="text-emerald-600 dark:text-emerald-400">5.</span> <span className="text-zinc-700 dark:text-zinc-300">Dashboard de Consumo (Inicio):</span> Consulta la RAM total en uso y qué modelo consume más en memoria, junto al uso histórico (sesiones, mensajes y corridas por modelo).</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">6.</span> <span className="text-zinc-700 dark:text-zinc-300">Playground:</span> Prueba modelos con parámetros personalizados (temperature, top_p, etc.) y compara respuestas.</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">7.</span> <span className="text-zinc-700 dark:text-zinc-300">Historial & Graph:</span> Revisa consultas, bitácoras, auditoría y el grafo de conocimiento del proyecto.</p>
            <p><span className="text-emerald-600 dark:text-emerald-400">8.</span> <span className="text-zinc-700 dark:text-zinc-300">Memoria Persistente:</span> Todos los datos se guardan en SQLite local. El grafo de conocimiento evoluciona con cada interacción.</p>
          </div>
        </div>
      </section>

      {/* Acciones Rápidas */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveView('chat')}
            className="p-4 bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-amber-400 dark:hover:border-emerald-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <MessageSquare className="w-5 h-5 text-amber-500 dark:text-emerald-400" />
              <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-amber-500 dark:group-hover:text-emerald-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">Chat del Proyecto</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Consulta tu código fuente con memoria inyectada en tiempo real.</p>
          </button>

          <button
            onClick={() => setActiveView('agents')}
            className="p-4 bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-amber-400 dark:hover:border-emerald-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Bot className="w-5 h-5 text-amber-500 dark:text-emerald-400" />
              <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-amber-500 dark:group-hover:text-emerald-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">Gestor de Agentes</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Administra, configura y activa tus agentes especializados.</p>
          </button>

          <button
            onClick={() => setActiveView('planes')}
            className="p-4 bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-sky-400 dark:hover:border-blue-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Play className="w-5 h-5 text-sky-500 dark:text-blue-400" />
              <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-sky-500 dark:group-hover:text-blue-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">Ejecución de Planes</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Genera y ejecuta planes con el pipeline de agentes que elijas.</p>
          </button>

          <button
            onClick={() => setActiveView('ollama')}
            className="p-4 bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-amber-400 dark:hover:border-amber-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Box className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">Gestor Ollama</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Inicia/detén el servicio y los modelos del servidor local.</p>
          </button>
        </div>
      </section>

      {/* Lista de Modelos */}
      <section className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-300">Modelos Detectados</h2>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
          {models.length === 0 ? (
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-500 py-2">No se encontraron modelos locales.</p>
          ) : (
            models.map((m) => {
              const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
              return (
                <div key={m.name} className="py-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-500 dark:text-emerald-400" />
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">{m.name}</span>
                  </div>
                  <span className="text-zinc-500 dark:text-zinc-400">💾 {sizeGb} GB</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
