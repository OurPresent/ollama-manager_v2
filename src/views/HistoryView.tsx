import React, { useState } from 'react';
import { getGraphNodes, getTaskLogs } from '../services/memoryDb';
import { History, Share2, FileText } from 'lucide-react';

interface Props {
  projectName: string;
}

export const HistoryView: React.FC<Props> = ({ projectName }) => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'logs'>('nodes');
  const nodes = getGraphNodes(projectName);
  const logs = getTaskLogs(projectName);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      <header className="border-b border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" /> Memoria Persistente (Grafo & MD)
        </h1>
        <p className="text-xs text-zinc-400">Inspección de la base de conocimiento registrada para "{projectName}"</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'nodes' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" /> Nodos del Grafo ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition ${
            activeTab === 'logs' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Bitácoras Markdown ({logs.length})
        </button>
      </div>

      {/* Contenido */}
      {activeTab === 'nodes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500">No hay nodos registrados en el grafo.</p>
          ) : (
            nodes.map((n) => (
              <div key={n.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-emerald-400 font-bold">{n.title}</span>
                  <span className="bg-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400">{n.nodeType}</span>
                </div>
                <p className="text-zinc-300 whitespace-pre-wrap">{n.content}</p>
                <span className="text-[10px] text-zinc-500 block text-right">{new Date(n.updatedAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500">No hay bitácoras guardadas.</p>
          ) : (
            logs.map((log) => (
              <details key={log.taskId} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 font-mono text-xs space-y-2">
                <summary className="cursor-pointer font-bold text-emerald-400 flex justify-between items-center">
                  <span>📌 {log.taskId}: {log.title}</span>
                  <span className="text-[10px] text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-zinc-800 text-zinc-300 font-sans whitespace-pre-wrap">
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