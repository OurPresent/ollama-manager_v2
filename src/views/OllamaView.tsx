import React, { useState } from 'react';
import { OllamaModel } from '../types';
import { pullModelStream, deleteModel } from '../services/ollama';
import { Box, Download, Trash2, Loader2, HardDrive } from 'lucide-react';

interface Props {
  models: OllamaModel[];
  refreshModels: () => void;
}

export const OllamaView: React.FC<Props> = ({ models, refreshModels }) => {
  const [modelToPull, setModelToPull] = useState('');
  const [pullStatus, setPullStatus] = useState('');
  const [pullProgress, setPullProgress] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const handlePull = async () => {
    if (!modelToPull.trim() || isPulling) return;
    setIsPulling(true);
    setPullProgress(0);
    setPullStatus('Iniciando descarga...');

    const success = await pullModelStream(modelToPull.trim(), (status, pct) => {
      setPullStatus(status);
      setPullProgress(pct);
    });

    if (success) {
      setModelToPull('');
      refreshModels();
    } else {
      setPullStatus('Error al descargar el modelo.');
    }
    setIsPulling(false);
  };

  const handleDelete = async (modelName: string) => {
    if (confirm(`¿Borrar modelo ${modelName}?`)) {
      await deleteModel(modelName);
      refreshModels();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      <header className="border-b border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2">
          <Box className="w-5 h-5 text-amber-400" /> Gestor de Modelos Ollama Hub
        </h1>
        <p className="text-xs text-zinc-400">Descarga y administración local de almacenamiento</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel Pull */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" /> Descargar Modelo desde Hub
          </h2>

          <div className="space-y-2">
            <input
              type="text"
              value={modelToPull}
              onChange={(e) => setModelToPull(e.target.value)}
              placeholder="ej: qwen2.5:7b, deepseek-coder:6.7b, phi4"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={handlePull}
              disabled={isPulling || !modelToPull.trim()}
              className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 py-2.5 rounded-lg font-mono text-xs transition flex justify-center items-center gap-2"
            >
              {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Iniciar Descarga
            </button>
          </div>

          {isPulling && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between font-mono text-xs text-zinc-400">
                <span>{pullStatus}</span>
                <span>{pullProgress}%</span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className="bg-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${pullProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel Lista */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-400" /> Modelos Almacenados
          </h2>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {models.map((m) => {
              const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
              return (
                <div
                  key={m.name}
                  className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs"
                >
                  <div>
                    <p className="font-bold text-zinc-200">{m.name}</p>
                    <p className="text-[10px] text-zinc-500">Tamaño: {sizeGb} GB</p>
                  </div>
                  <button
                    onClick={() => handleDelete(m.name)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};