import React from 'react';
import { OllamaModel, ActiveView } from '../types';
import { MetricCard } from '../components/MetricCard';
import { Cpu, Terminal, ArrowRight, MessageSquare, Bot, Box, Play } from 'lucide-react';

interface Props {
  isOllamaOnline: boolean;
  models: OllamaModel[];
  setActiveView: (view: ActiveView) => void;
}

export const HomeView: React.FC<Props> = ({ isOllamaOnline, models, setActiveView }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      <header className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-mono font-bold tracking-tight">🚀 LLMX v2 — Control Center Local</h1>
        <p className="text-xs font-mono text-zinc-400 mt-1">
          Orquestación local de Modelos, Agentes y Grafos de Memoria
        </p>
      </header>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Modelos Instalados" value={models.length} subtext="En servidor Ollama" accentColor="green" />
        <MetricCard label="Agentes Disponibles" value={6} subtext="Pipeline secuencial" accentColor="blue" />
        <MetricCard label="Estado Servidor" value={isOllamaOnline ? 'ONLINE' : 'OFFLINE'} subtext="http://localhost:11434" accentColor={isOllamaOnline ? 'green' : 'rose'} />
        <MetricCard label="Privacidad / Local" value="100%" subtext="Sin fugas a la nube" accentColor="amber" />
      </div>

      {/* Instrucciones de Uso */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-mono font-semibold text-zinc-300 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Guía Rápida de Uso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-400">
          <div className="space-y-2">
            <p><span className="text-emerald-400">1.</span> <span className="text-zinc-300">Chat del Proyecto:</span> Consulta tu código con IA. El sistema inyecta automáticamente el contexto del proyecto (bitácoras, entidades, componentes) en cada consulta.</p>
            <p><span className="text-emerald-400">2.</span> <span className="text-zinc-300">Pipeline de Agentes:</span> Ejecuta flujos de trabajo automáticos: PM → Backend → Frontend → QA → DevOps. Cada agente especializado procesa el proyecto.</p>
            <p><span className="text-emerald-400">3.</span> <span className="text-zinc-300">Gestor Ollama:</span> Descarga, elimina y gestiona modelos LLM locales directamente desde la interfaz.</p>
          </div>
          <div className="space-y-2">
            <p><span className="text-emerald-400">4.</span> <span className="text-zinc-300">Playground:</span> Prueba modelos con parámetros personalizados (temperature, top_p, etc.) y compara respuestas.</p>
            <p><span className="text-emerald-400">5.</span> <span className="text-zinc-300">Historial:</span> Revisa todas las consultas, agentes ejecutados y cambios en el grafo de conocimiento del proyecto.</p>
            <p><span className="text-emerald-400">6.</span> <span className="text-zinc-300">Memoria Persistente:</span> Todos los datos se guardan en SQLite local. El grafo de conocimiento evoluciona con cada interacción.</p>
          </div>
        </div>
      </section>

      {/* Acciones Rápidas */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wider">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveView('chat')}
            className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-left hover:border-emerald-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-200">Chat del Proyecto</h3>
            <p className="text-xs text-zinc-400 mt-1">Consulta tu código fuente con memoria inyectada en tiempo real.</p>
          </button>

          <button
            onClick={() => setActiveView('agents')}
            className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-left hover:border-emerald-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-200">Gestor de Agentes</h3>
            <p className="text-xs text-zinc-400 mt-1">Administra y configura tus agentes especializados.</p>
          </button>

          <button
            onClick={() => setActiveView('planes')}
            className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-left hover:border-blue-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Play className="w-5 h-5 text-blue-400" />
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-200">Ejecución de Planes</h3>
            <p className="text-xs text-zinc-400 mt-1">Genera y ejecuta planes técnicos con pipeline de agentes.</p>
          </button>

          <button
            onClick={() => setActiveView('ollama')}
            className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-left hover:border-amber-500/40 transition group"
          >
            <div className="flex justify-between items-center mb-2">
              <Box className="w-5 h-5 text-amber-400" />
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition" />
            </div>
            <h3 className="font-mono text-sm font-bold text-zinc-200">Gestor Ollama</h3>
            <p className="text-xs text-zinc-400 mt-1">Descarga o elimina LLMs directamente desde Ollama Hub.</p>
          </button>
        </div>
      </section>

      {/* Lista de Modelos */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-mono font-semibold text-zinc-300">Modelos Detectados</h2>
        <div className="divide-y divide-zinc-800/60">
          {models.length === 0 ? (
            <p className="text-xs font-mono text-zinc-500 py-2">No se encontraron modelos locales.</p>
          ) : (
            models.map((m) => {
              const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
              return (
                <div key={m.name} className="py-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-zinc-200">{m.name}</span>
                  </div>
                  <span className="text-zinc-400">💾 {sizeGb} GB</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};