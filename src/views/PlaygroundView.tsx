import React, { useState } from 'react';
import { OllamaModel } from '../types';
import { getOllamaBaseUrl } from '../services/ollama';
import { Sliders, Play, Loader2 } from 'lucide-react';

interface Props {
  models: OllamaModel[];
  selectedModel: string;
}

export const PlaygroundView: React.FC<Props> = ({ models, selectedModel }) => {
  const [model, setModel] = useState(selectedModel || (models[0]?.name ?? ''));
  const [systemPrompt, setSystemPrompt] = useState('Eres un asistente conciso que responde con código limpio y estructurado.');
  const [userPrompt, setUserPrompt] = useState('Escribe un decorador en TypeScript para medir el tiempo de ejecución de un método.');
  const [temperature, setTemperature] = useState(0.7);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = async () => {
    if (!model || !userPrompt.trim()) return;
    setIsLoading(true);
    setResponse('');

    try {
      const baseUrl = await getOllamaBaseUrl();
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          options: { temperature },
          stream: false,
        }),
      });

      const data = await res.json();
      setResponse(data.message?.content || 'Sin respuesta.');
    } catch {
      setResponse('Error al conectar con la API de Ollama.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-mono font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Sliders className="w-5 h-5 text-sky-500 dark:text-emerald-400" /> Playground de Prompts
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Prueba respuestas e hiperparámetros en tiempo real</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">Modelo:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-500 dark:focus:border-emerald-500/50"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">System Prompt:</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full h-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-500 dark:focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">User Prompt:</label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="w-full h-28 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-500 dark:focus:border-emerald-500/50"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>Temperatura:</span>
              <span>{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-sky-500 dark:accent-emerald-400"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isLoading}
            className="w-full bg-sky-50 dark:bg-emerald-500/10 border border-sky-300 dark:border-emerald-500/30 text-sky-600 dark:text-emerald-400 hover:bg-sky-100 dark:hover:bg-emerald-500/20 py-2.5 rounded-lg font-mono text-xs transition flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Probar Prompt
          </button>
        </div>

        {/* Panel Respuesta */}
        <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap overflow-y-auto max-h-[550px]">
          <span className="text-zinc-400 dark:text-zinc-500 block mb-2">// Respuesta del Modelo</span>
          {response ? (
            <span className="text-zinc-700 dark:text-zinc-200">{response}</span>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-600">Haz clic en "Probar Prompt" para ver el resultado...</span>
          )}
        </div>
      </div>
    </div>
  );
};
