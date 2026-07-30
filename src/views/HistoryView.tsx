import React, { useState } from 'react';
import { getGraphNodes, getTaskLogs } from '../services/memoryDb';
import { History, Share2, FileText } from 'lucide-react';

interface Props {
  projectInfo: { name: string; path: string };
}

export const HistoryView: React.FC<Props> = ({ projectInfo }) => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'logs'>('nodes');
  const nodes = getGraphNodes(projectInfo.name);
  const logs = getTaskLogs(projectInfo.name);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <History className="w-5 h-5 text-amber-500 dark:text-emerald-400" /> Memoria Persistente (Grafo & MD)
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
      </div>

      {/* Contenido */}
      {activeTab === 'nodes' ? (
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
      ) : (
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
    </div>
  );
};