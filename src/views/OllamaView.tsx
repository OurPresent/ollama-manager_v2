import React, { useState, useEffect, useCallback } from 'react';
import { OllamaModel } from '../types';
import { pullModelStream, deleteModel, getRunningModels, loadOllamaModel, stopOllamaModel } from '../services/ollama';
import type { RunningModelDto } from '../types/dto';
import { Box, Download, Trash2, Loader2, HardDrive, MemoryStick, XCircle, Play, RefreshCw } from 'lucide-react';

interface Props {
  models: OllamaModel[];
  refreshModels: () => void;
}

export const OllamaView: React.FC<Props> = ({ models, refreshModels }) => {
  const [modelToPull, setModelToPull] = useState('');
  const [pullStatus, setPullStatus] = useState('');
  const [pullProgress, setPullProgress] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [runningModels, setRunningModels] = useState<RunningModelDto[]>([]);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [modelToLoad, setModelToLoad] = useState('');
  const [memoryError, setMemoryError] = useState('');

  const refreshRunningModels = useCallback(async () => {
    setLoadingMemory(true);
    setMemoryError('');
    try {
      const running = await getRunningModels();
      setRunningModels(running);
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : 'Error al consultar modelos en memoria');
    } finally {
      setLoadingMemory(false);
    }
  }, []);

  useEffect(() => {
    refreshRunningModels();
    const interval = setInterval(refreshRunningModels, 10000);
    return () => clearInterval(interval);
  }, [refreshRunningModels]);

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

  const handleLoadModel = async () => {
    if (!modelToLoad.trim()) return;
    setMemoryError('');
    try {
      await loadOllamaModel(modelToLoad.trim());
      setModelToLoad('');
      await refreshRunningModels();
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : 'Error al cargar el modelo en memoria');
    }
  };

  const handleStopModel = async (model: string) => {
    setMemoryError('');
    try {
      await stopOllamaModel(model);
      await refreshRunningModels();
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : 'Error al descargar el modelo de memoria');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes)} B`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Box className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Gestor de Modelos Ollama Hub
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Descarga y administración local de almacenamiento</p>
      </header>

      {/* Panel Modelos en Memoria */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-rose-500 dark:text-rose-400" /> Modelos en Memoria
          </h2>
          <button
            onClick={refreshRunningModels}
            disabled={loadingMemory}
            className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-emerald-400 transition disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMemory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={modelToLoad}
            onChange={(e) => setModelToLoad(e.target.value)}
            placeholder="Nombre del modelo a cargar en memoria (ej: llama2:latest)"
            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
          />
          <button
            onClick={handleLoadModel}
            disabled={!modelToLoad.trim()}
            className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg font-mono text-xs transition flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> Cargar
          </button>
        </div>

        {memoryError && <p className="font-mono text-xs text-rose-500">{memoryError}</p>}

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {runningModels.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
              {loadingMemory ? 'Consultando memoria...' : 'No hay modelos cargados en memoria.'}
            </p>
          ) : (
            runningModels.map((m) => (
              <div
                key={m.model}
                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-xs"
              >
                <div>
                  <p className="font-bold text-zinc-700 dark:text-zinc-200">{m.model}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                    VRAM: {formatBytes(m.sizeVram)}
                    {m.contextLength != null ? ` · Contexto: ${m.contextLength}` : ''}
                    {m.expiresAt ? ` · Expira: ${new Date(m.expiresAt).toLocaleTimeString()}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleStopModel(m.model)}
                  className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                  title="Descargar de memoria"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel Pull */}
        <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-500 dark:text-emerald-400" /> Descargar Modelo desde Hub
          </h2>

          <div className="space-y-2">
            <input
              type="text"
              value={modelToPull}
              onChange={(e) => setModelToPull(e.target.value)}
              placeholder="ej: qwen2.5:7b, deepseek-coder:6.7b, phi4"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
            />
            <button
              onClick={handlePull}
              disabled={isPulling || !modelToPull.trim()}
              className="w-full bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 py-2.5 rounded-lg font-mono text-xs transition flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Iniciar Descarga
            </button>
          </div>

          {isPulling && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span>{pullStatus}</span>
                <span>{pullProgress}%</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <div
                  className="bg-amber-500 dark:bg-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${pullProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel Lista */}
        <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-500 dark:text-blue-400" /> Modelos Almacenados
          </h2>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {models.map((m) => {
              const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
              return (
                <div
                  key={m.name}
                  className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-xs"
                >
                  <div>
                    <p className="font-bold text-zinc-700 dark:text-zinc-200">{m.name}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Tamaño: {sizeGb} GB</p>
                  </div>
                  <button
                    onClick={() => handleDelete(m.name)}
                    className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
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
