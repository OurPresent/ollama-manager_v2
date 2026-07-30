import React, { useState } from 'react';
import { streamChatCompletion } from '../services/ollama';
import { parseAndSaveMemoryJson } from '../services/memoryDb';
import { executeAllActions, formatActionResult } from '../services/fileActions';
import { Play, CheckCircle2, Loader2, Sparkles, FileCode } from 'lucide-react';

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
  const [executingActions, setExecutingActions] = useState(false);

  const projectPath = projectInfo.path || projectInfo.name;

  const handleGeneratePlan = async () => {
    if (!selectedModel || !goal) return;
    setIsGeneratingPlan(true);
    setPlan('');

    const sysPrompt = `Eres un Arquitecto de Software Lead. Diseña un plan técnico paso a paso detallado para el proyecto "${projectInfo.name}".

CAPACIDADES DEL SISTEMA:
Puedes realizar operaciones de archivos dentro del proyecto usando bloques <action> que serán ejecutados automáticamente por Python.

Acciones disponibles:
- write_file / create_file: Crear o sobrescribir un archivo (requiere: path, content)
- read_file: Leer el contenido de un archivo (requiere: path)
- append_file: Añadir contenido al final de un archivo (requiere: path, content)
- delete_file: Eliminar un archivo (requiere: path)
- create_directory / mkdir: Crear un directorio (requiere: path)
- list_files: Listar archivos en un directorio (requiere: path)

Ejemplo de uso:
<action>
{"action": "write_file", "path": "src/components/Componente.tsx", "content": "// contenido del archivo"}
</action>`;
    const userPrompt = `PROYECTO: ${projectInfo.name}\nRUTA: ${projectPath || 'No especificada'}\n\nCÓDIGO DE ENTORNO:\n${projectContext}\n\nOBJETIVO:\n${goal}`;

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

      // Ejecutar acciones si las hay
      if (projectPath) {
        setExecutingActions(true);
        const { cleanResponse, results } = await executeAllActions(accumulated, projectPath);
        if (results.length > 0) {
          let actionResultsText = '\n\n---\n### 📋 Resultados de acciones:\n\n';
          results.forEach((r) => {
            actionResultsText += formatActionResult(r.action, r.result) + '\n\n';
          });
          setPlan(cleanResponse + actionResultsText);
        } else {
          setPlan(cleanResponse || accumulated);
        }
        setExecutingActions(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
      setExecutingActions(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!selectedModel || !plan) return;
    setIsRunningPipeline(true);
    setAgentOutputs([]);

    const AGENT_ROLES = [
      { name: 'Gestor de Proyecto Lead', sys: `Project Manager Senior. Desglosa tareas y estructura la ejecución para el proyecto "${projectInfo.name}".

Puedes crear archivos de planificación y documentación usando bloques <action>:
<action>
{"action": "write_file", "path": "docs/plan.md", "content": "contenido del plan"}
</action>` },
      { name: 'Desarrollador Backend', sys: `Backend Senior en Python/TypeScript para el proyecto "${projectInfo.name}". Escribe arquitectura y código de servicios.

Puedes crear y modificar archivos del proyecto usando bloques <action>:
<action>
{"action": "write_file", "path": "src/services/mi-servicio.ts", "content": "// código del servicio"}
</action>` },
      { name: 'Desarrollador Frontend', sys: `Frontend Lead en React, TS y Tailwind para el proyecto "${projectInfo.name}". Diseña interfaces avanzadas.

Puedes crear y modificar archivos del proyecto usando bloques <action>:
<action>
{"action": "write_file", "path": "src/components/MiComponente.tsx", "content": "// código del componente"}
</action>` },
      { name: 'DBA (SQL/NoSQL)', sys: `DBA Experto para el proyecto "${projectInfo.name}". Diseña esquemas, relaciones e índices eficientes.

Puedes crear archivos de esquemas y migraciones usando bloques <action>.` },
      { name: 'QA Tester', sys: `Tester QA para el proyecto "${projectInfo.name}". Genera estrategias de testing, casos de borde y suite de pruebas.

Puedes crear archivos de tests usando bloques <action>.` },
      { name: 'DevOps Engineer', sys: `Eng DevOps para el proyecto "${projectInfo.name}". Diseña Dockerfiles, pipelines CI/CD y configuraciones de despliegue.

Puedes crear archivos de configuración usando bloques <action>.` }
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

        // Ejecutar acciones del agente
        if (projectPath) {
          const { cleanResponse, results } = await executeAllActions(currentOutput, projectPath);
          if (results.length > 0) {
            let actionResultsText = '\n\n---\n📋 Acciones ejecutadas:\n';
            results.forEach((r) => {
              const status = r.result.success ? '✅' : '❌';
              actionResultsText += `\n${status} \`${r.action.path}\`: ${r.result.success ? 'OK' : (r.result.error || 'Error')}`;
            });
            currentOutput = cleanResponse + actionResultsText;
          } else {
            currentOutput = cleanResponse || currentOutput;
          }
          setAgentOutputs((prev) =>
            prev.map((item) => (item.role === role.name ? { role: role.name, output: currentOutput } : item))
          );
        }

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
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Sparkles className="w-8 h-8 text-sky-500 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Ejecución de Planes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Genera y ejecuta planes técnicos con el pipeline de agentes</p>
        </div>
      </header>

      {/* Project path indicator */}
      {projectInfo.path && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-blue-500/10 border border-sky-200 dark:border-blue-500/30 rounded-lg text-xs font-mono">
          <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-blue-400" />
          <span className="text-sky-700 dark:text-blue-300">Proyecto activo: <strong>{projectInfo.path}</strong></span>
          <span className="text-sky-500 dark:text-blue-400 ml-1">(Python activo)</span>
        </div>
      )}

      {/* 1. Definición del Plan */}
      <section className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-mono font-semibold text-sky-600 dark:text-blue-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> 1️⃣ Definir Objetivo & Generar Plan Técnico
        </h2>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ej: Implementar autenticación OAuth2 con JWT, migrar tablas de SQLite y agregar tests unitarios..."
          className="w-full h-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-sans text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-500 dark:focus:border-blue-500/50"
        />
        <div className="flex gap-2">
          <button
            onClick={handleGeneratePlan}
            disabled={isGeneratingPlan || !goal}
            className="flex items-center gap-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 px-4 py-2 rounded-lg font-mono text-sm transition"
          >
            {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generar Plan con IA
          </button>
          {executingActions && (
            <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-200 dark:border-blue-500/30 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500 dark:text-blue-400" />
              <span className="text-xs font-mono text-sky-700 dark:text-blue-300">Ejecutando acciones...</span>
            </div>
          )}
        </div>

        {plan && (
          <div className="mt-4">
            <label className="block font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">Plan Confirmado:</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full h-40 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
            />
          </div>
        )}
      </section>

      {/* 2. Ejecución del Pipeline */}
      {plan && (
        <section className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400">2️⃣ Ejecución del Pipeline Secuencial</h2>
            <button
              onClick={handleRunPipeline}
              disabled={isRunningPipeline}
              className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-5 py-2 rounded-lg font-mono text-sm transition"
            >
              {isRunningPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Ejecutar Agentes
            </button>
          </div>

          <div className="space-y-4 mt-4">
            {agentOutputs.map((out, idx) => (
              <div key={idx} className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 rounded-lg p-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2">
                  <span className="text-sky-600 dark:text-blue-400 font-bold">{out.role}</span>
                  {out.output !== 'Ejecutando...' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-amber-500 dark:text-amber-500 animate-spin" />
                  )}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">{out.output}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};