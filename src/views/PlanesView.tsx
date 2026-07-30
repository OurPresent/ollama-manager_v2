import React, { useState } from 'react';
import { streamChatCompletion } from '../services/ollama';
import { parseAndSaveMemoryJson } from '../services/memoryDb';
import { Play, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface Props {
  selectedModel: string;
  projectInfo: { name: string; path: string };
  projectContext: string;
}

export const PlanesView: React.FC<Props> = ({ selectedModel, projectInfo, projectContext }) => {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [agentOutputs, setAgentOutputs] = useState<{ role: string; output: string }[]>([]);

  const handleGeneratePlan = async () => {
    if (!selectedModel || !goal) return;
    setIsGeneratingPlan(true);
    setPlan('');

    const sysPrompt = 'Eres un Arquitecto de Software Lead. Diseña un plan técnico paso a paso detallado.';
    const userPrompt = `PROYECTO: ${projectInfo.name}\nRUTA: ${projectInfo.path || 'No especificada'}\n\nCÓDIGO DE ENTORNO:\n${projectContext}\n\nOBJETIVO:\n${goal}`;

    try {
      let accumulated = '';
      await streamChatCompletion(
        selectedModel,
        [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ],
        (chunk) => {
          accumulated += chunk;
          setPlan(accumulated);
        }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!selectedModel || !plan) return;
    setIsRunningPipeline(true);
    setAgentOutputs([]);

    const AGENT_ROLES = [
      { name: 'Gestor de Proyecto Lead', sys: 'Project Manager Senior. Desglosa tareas y estructura la ejecución.' },
      { name: 'Desarrollador Backend', sys: 'Backend Senior en Python/TypeScript. Escribe arquitectura y código de servicios.' },
      { name: 'Desarrollador Frontend', sys: 'Frontend Lead en React, TS y Tailwind. Diseña interfaces avanzadas.' },
      { name: 'DBA (SQL/NoSQL)', sys: 'DBA Experto. Diseña esquemas, relaciones e índices eficientes.' },
      { name: 'QA Tester', sys: 'Tester QA. Genera estrategias de testing, casos de borde y suite de pruebas.' },
      { name: 'DevOps Engineer', sys: 'Eng DevOps. Diseña Dockerfiles, pipelines CI/CD y configuraciones de despliegue.' }
    ];

    let prevOutputs: string[] = [];

    for (const role of AGENT_ROLES) {
      const promptAcc = `PLAN TÉCNICO:\n${plan}\n\nAVANCES PREVIOS DE OTROS AGENTES:\n${prevOutputs.slice(-2).join('\n---\n')}`;
      let currentOutput = '';

      setAgentOutputs((prev) => [...prev, { role: role.name, output: 'Ejecutando...' }]);

      try {
        await streamChatCompletion(
          selectedModel,
          [
            { role: 'system', content: role.sys },
            { role: 'user', content: promptAcc }
          ],
          (chunk) => {
            currentOutput += chunk;
            setAgentOutputs((prev) =>
              prev.map((item) => (item.role === role.name ? { role: role.name, output: currentOutput } : item))
            );
          }
        );
        prevOutputs.push(`### ${role.name}\n${currentOutput}`);
      } catch (err) {
        console.error(err);
      }
    }

    // Auditoría Final
    let auditOutput = '';
    setAgentOutputs((prev) => [...prev, { role: 'Auditoría & Memoria', output: 'Sintetizando bitácora...' }]);

    const auditSys = 'Tech Auditor Lead. Analiza el trabajo del equipo, genera un resumen técnico y emite el bloque json_memory con la bitácora .md.';
    const auditPrompt = `PLAN:\n${plan}\n\nRESPUESTAS DEL EQUIPO:\n${prevOutputs.join('\n\n')}`;

    await streamChatCompletion(
      selectedModel,
      [
        { role: 'system', content: auditSys },
        { role: 'user', content: auditPrompt }
      ],
      (chunk) => {
        auditOutput += chunk;
        setAgentOutputs((prev) =>
          prev.map((item) => (item.role === 'Auditoría & Memoria' ? { role: 'Auditoría & Memoria', output: auditOutput } : item))
        );
      }
    );

    // Guardar en la BD local de TS
    parseAndSaveMemoryJson(projectInfo.name, auditOutput);
    setIsRunningPipeline(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      <header className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <Sparkles className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-mono font-bold">Ejecución de Planes</h1>
          <p className="text-sm text-zinc-400">Genera y ejecuta planes técnicos con el pipeline de agentes</p>
        </div>
      </header>

      {/* 1. Definición del Plan */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-mono font-semibold text-blue-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> 1️⃣ Definir Objetivo & Generar Plan Técnico
        </h2>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ej: Implementar autenticación OAuth2 con JWT, migrar tablas de SQLite y agregar tests unitarios..."
          className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-sans text-sm focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleGeneratePlan}
          disabled={isGeneratingPlan || !goal}
          className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 px-4 py-2 rounded-lg font-mono text-sm transition"
        >
          {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Generar Plan con IA
        </button>

        {plan && (
          <div className="mt-4">
            <label className="block font-mono text-xs text-zinc-400 mb-1">Plan Confirmado:</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300 focus:outline-none"
            />
          </div>
        )}
      </section>

      {/* 2. Ejecución del Pipeline */}
      {plan && (
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-mono font-semibold text-emerald-400">2️⃣ Ejecución del Pipeline Secuencial</h2>
            <button
              onClick={handleRunPipeline}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-5 py-2 rounded-lg font-mono text-sm transition"
            >
              {isRunningPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Ejecutar Agentes
            </button>
          </div>

          <div className="space-y-4 mt-4">
            {agentOutputs.map((out, idx) => (
              <div key={idx} className="border border-zinc-800 bg-zinc-950/80 rounded-lg p-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
                  <span className="text-blue-400 font-bold">{out.role}</span>
                  {out.output !== 'Ejecutando...' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  )}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300">{out.output}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};