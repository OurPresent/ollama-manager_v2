import React, { useState, useEffect, useRef, useMemo } from 'react';
import { loadOllamaModel, stopOllamaModel, streamChatCompletion } from '../services/ollama';
import { parseAndSaveMemoryJson } from '../services/memoryDb';
import { runAgentToolLoop, ACTION_SPEC } from '../services/agentToolLoop';
import { approvalSystem, ApprovalRequest } from '../services/approvalSystem';
import {
  saveTaskLogToSqlite,
  createPlan,
  startPlanRun,
  finishPlanRun,
  startAgentRun,
  finishAgentRun,
  createPlanSteps,
  fetchPlanSteps,
  updatePlanStep,
  fetchActivePlanRun,
  updatePlanClient,
  PlanStepDto,
} from '../services/apiDb';
import type { PersistedAgent } from '../types';
import {
  Play,
  CheckCircle2,
  Loader2,
  Sparkles,
  FileCode,
  ChevronUp,
  ChevronDown,
  Users,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Send,
} from 'lucide-react';

interface Props {
  selectedModel: string;
  projectInfo: { id?: string; name: string; path: string };
  projectContext: string;
  agents: PersistedAgent[];
}

const ROLE_PRIORITY = [
  'Project Manager',
  'Backend Developer',
  'Frontend Developer',
  'Database Administrator',
  'Quality Assurance',
  'DevOps',
];

const rolePriority = (role: string): number => {
  const idx = ROLE_PRIORITY.indexOf(role);
  return idx === -1 ? 999 : idx;
};

const STEP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente de ejecutar', cls: 'text-zinc-500 border-zinc-300 dark:border-zinc-700' },
  running: { label: 'Ejecutando…', cls: 'text-amber-600 border-amber-300 dark:border-amber-500/40' },
  needs_approval: { label: 'En revisión del usuario', cls: 'text-sky-600 border-sky-300 dark:border-blue-500/40' },
  completed: { label: 'Completado', cls: 'text-emerald-600 border-emerald-300 dark:border-emerald-500/40' },
  error: { label: 'Error', cls: 'text-rose-600 border-rose-300 dark:border-rose-500/40' },
  cancelled: { label: 'Cancelado', cls: 'text-zinc-500 border-zinc-300 dark:border-zinc-700' },
};

const AutoTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => {
    useEffect(() => {
      if (ref && typeof ref !== 'function') {
        const el = (ref as React.RefObject<HTMLTextAreaElement>).current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
      }
    }, [props.value, ref]);
    return <textarea ref={ref} {...props} rows={1} />;
  }
);
AutoTextarea.displayName = 'AutoTextarea';

export const PlanesView: React.FC<Props> = ({ selectedModel, projectInfo, projectContext, agents }) => {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [executingActions, setExecutingActions] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [executionMode, setExecutionMode] = useState<'agents' | 'model'>('agents');
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);

  const [directInput, setDirectInput] = useState('');
  const [directMessages, setDirectMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [directSending, setDirectSending] = useState(false);

  const [runId, setRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PlanStepDto[]>([]);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [startingPlan, setStartingPlan] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditOutput, setAuditOutput] = useState('');
  const [error, setError] = useState('');
  const feedbackMapRef = useRef<Record<string, string>>({});
  const agentRunRef = useRef<Record<string, string>>({});
  const planInputRef = useRef<HTMLTextAreaElement>(null);
  const runningCardRef = useRef<HTMLDivElement>(null);
  const auditOutputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return approvalSystem.subscribe(setPendingApprovals);
  }, []);

  const handleApprovalDecision = (requestId: string, decision: 'approved' | 'rejected' | 'alternative', selectedAlternative?: number) => {
    approvalSystem.resolveApproval(requestId, decision, selectedAlternative);
  };

  const activeAgents = agents.filter((a) => a.isActive !== false);
  const orderedByRole = useMemo(
    () => [...activeAgents].sort((a, b) => rolePriority(a.role) - rolePriority(b.role)),
    [activeAgents]
  );
  const byId = useMemo(() => new Map(activeAgents.map((a) => [a.id, a])), [activeAgents]);
  const pipelineAgents = selectedAgentIds
    .map((id) => byId.get(id))
    .filter((a): a is PersistedAgent => Boolean(a));

  useEffect(() => {
    setSelectedAgentIds((prev) => {
      const available = new Set(agents.map((a) => a.id));
      const kept = prev.filter((id) => available.has(id));
      if (kept.length > 0) return kept;
      return [...agents]
        .filter((a) => a.isActive !== false)
        .sort((a, b) => rolePriority(a.role) - rolePriority(b.role))
        .map((a) => a.id);
    });
  }, [agents]);

  // Resume del plan activo desde la BD (sobrevive a cambio de pantalla y fallos)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!projectInfo.id) return;
      try {
        const { run: activeRun, plan: activePlan } = await fetchActivePlanRun(projectInfo.id);
        if (cancelled) return;
        if (activeRun && activePlan) {
          setGoal(String(activePlan.goal ?? ''));
          setPlan(String(activePlan.content ?? ''));
          setPlanId(String(activeRun.plan_id ?? ''));
          setRunId(String(activeRun.id ?? ''));
          setPlanConfirmed(true);
          try {
            const stepsData = await fetchPlanSteps(String(activeRun.id));
            if (!cancelled) setSteps(stepsData);
          } catch (err) {
            console.error('Error cargando pasos del plan activo:', err);
          }
        } else {
          const draftKey = `llmx_plan_draft_${projectInfo.id}`;
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as { goal?: string; selectedAgentIds?: string[] };
              if (parsed.goal) setGoal(parsed.goal);
              if (Array.isArray(parsed.selectedAgentIds) && parsed.selectedAgentIds.length > 0) {
                setSelectedAgentIds(parsed.selectedAgentIds);
              }
            } catch {
              // borrador corrupto, ignorar
            }
          }
        }
      } catch (err) {
        console.error('Error reanudando el plan:', err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [projectInfo.id]);

  // Guardar borrador del plan (goal + agentes) mientras no esté confirmado
  useEffect(() => {
    if (!projectInfo.id || planConfirmed) return;
    localStorage.setItem(
      `llmx_plan_draft_${projectInfo.id}`,
      JSON.stringify({ goal, selectedAgentIds })
    );
  }, [projectInfo.id, goal, selectedAgentIds, planConfirmed]);

  const toggleSelectAgent = (id: string) => {
    setSelectedAgentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const moveAgent = (index: number, direction: -1 | 1) => {
    setSelectedAgentIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveAgentDrag = (fromIndex: number, toIndex: number) => {
    setSelectedAgentIds((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const projectPath = projectInfo.path || projectInfo.name;

  const patchStep = (stepId: string, patch: Partial<PlanStepDto>) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  };

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
          { role: 'user', content: userPrompt },
        ],
        (chunk) => {
          accumulated += chunk;
          setPlan(accumulated);
        }
      );

      let finalPlan = accumulated;
      setPlan(finalPlan);

      if (projectInfo.id) {
        try {
          await createPlan({
            projectId: projectInfo.id,
            title: goal.slice(0, 80),
            goal,
            content: finalPlan,
          });
        } catch (err) {
          console.error('Error persistiendo plan:', err);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
      setExecutingActions(false);
      setPlanConfirmed(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!plan) return;
    setPlanConfirmed(true);
    if (planId && projectInfo.id) {
      try {
        await updatePlanClient(planId, {
          title: goal.slice(0, 80),
          goal,
          content: plan,
        });
      } catch (err) {
        console.error('Error actualizando el plan:', err);
      }
    }
  };

  const buildPromptForAgent = (agent: PersistedAgent, feedback: string): string => {
    if (pipelineAgents.length === 0) return '';
    const idx = pipelineAgents.findIndex((a) => a.id === agent.id);
    const previous = pipelineAgents.slice(0, idx);
    const prevOutputs = previous
      .map((a) => {
        const step = steps.find((s) => s.agent_id === a.id && s.status === 'completed');
        return step ? `### ${a.name}\n${step.output}` : '';
      })
      .filter(Boolean);

    const prevText =
      prevOutputs.length > 0 ? `\n\nAVANCES PREVIOS DE OTROS AGENTES:\n${prevOutputs.join('\n---\n')}` : '';

    const feedbackText = feedback ? `\n\nCOMENTARIOS / SIGUIENTES PASOS DEL USUARIO:\n${feedback}` : '';
    return `PLAN TÉCNICO:\n${plan}\n${prevText}${feedbackText}`;
  };

  const runAgent = async (step: PlanStepDto, feedback: string) => {
    if (runningStepId) return;
    setError('');
    setRunningStepId(step.id);
    patchStep(step.id, { status: 'running', output: '' });
    try {
      await updatePlanStep(step.id, { status: 'running', output: feedback ? `<!-- feedback: ${feedback} -->\n` : '' });
    } catch {
      // best-effort
    }

    const variableAgent = step.agent_id ? byId.get(step.agent_id) : undefined;
    const agent: PersistedAgent = variableAgent ?? {
      id: step.agent_id ?? '',
      name: step.agent_name,
      role: step.role,
      description: '',
      systemPrompt: '',
      status: 'idle',
    };
    const agentModel = step.model_name || agent.model || selectedModel;

    // Crear agent_run para el historial de ejecución
    let agentRunId = '';
    if (runId && agent.id) {
      try {
        agentRunId = await startAgentRun(runId, agent.id, agentModel);
        if (agentRunId) agentRunRef.current[step.id] = agentRunId;
      } catch (err) {
        console.error('Error creando agent_run:', err);
      }
    }

    const loadForAgent = agentModel !== selectedModel;
    if (loadForAgent) {
      try {
        await loadOllamaModel(agentModel);
      } catch (err) {
        console.error(`Error cargando modelo ${agentModel}:`, err);
      }
    }

    let currentOutput = '';
    try {
      const result = await runAgentToolLoop({
        model: agentModel,
        systemPrompt: agent.systemPrompt,
        userPrompt: buildPromptForAgent(agent, feedback),
        projectPath,
        recordMessageId: step.id,
        onText: (chunk) => {
          currentOutput += chunk;
          patchStep(step.id, { output: currentOutput });
        },
        onToolResult: (_action, _result, summary) => {
          currentOutput += `\n${summary}`;
          patchStep(step.id, { output: currentOutput });
        },
      });

      const finalOutput = result.finalText + result.summaries;
      patchStep(step.id, { output: finalOutput });
      try {
        await updatePlanStep(step.id, { output: finalOutput });
      } catch {
        // best-effort
      }

      // Pausa de interrupción: espera la revisión del usuario
      patchStep(step.id, { status: 'needs_approval', output: finalOutput });
      try {
        await updatePlanStep(step.id, { status: 'needs_approval', output: finalOutput });
      } catch {
        // best-effort
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error';
      patchStep(step.id, { status: 'error', output: `${currentOutput}\n\n[ERROR] ${msg}` });
      try {
        await updatePlanStep(step.id, { status: 'error', output: `${currentOutput}\n\n[ERROR] ${msg}` });
      } catch {
        // best-effort
      }
      if (agentRunId) await finishAgentRun(agentRunId, 'error', currentOutput).catch(() => undefined);
    } finally {
      if (loadForAgent) {
        try {
          await stopOllamaModel(agentModel);
        } catch (err) {
          console.error(`Error deteniendo modelo ${agentModel}:`, err);
        }
      }
      setRunningStepId(null);
    }
  };

  const handleMarkCompleted = async (step: PlanStepDto) => {
    const feedback = feedbackMapRef.current[step.id] ?? '';
    patchStep(step.id, { status: 'completed', feedback });
    try {
      await updatePlanStep(step.id, { status: 'completed', output: step.output, feedback });
    } catch {
      // best-effort
    }

    const agentRunId = agentRunRef.current[step.id];
    if (agentRunId) await finishAgentRun(agentRunId, 'completed', step.output).catch(() => undefined);

    try {
      await saveTaskLogToSqlite({
        taskId: `pipeline-${Date.now()}-${step.agent_name.replace(/\s+/g, '-').toLowerCase()}`,
        projectName: projectInfo.name,
        title: `Plan "${goal || projectInfo.name}": ${step.role || step.agent_name}`,
        markdownContent: step.output,
        tags: ['pipeline', step.role || step.agent_name],
        createdAt: new Date().toISOString(),
      });
      await parseAndSaveMemoryJson(projectInfo.name, step.output);
    } catch (err) {
      console.error('Error persistiendo salida del agente:', err);
    }
  };

  const handleStartStaged = async () => {
    if (!selectedModel || !plan) return;
    if (!planConfirmed) {
      setError('Confirma primero el enfoque con el botón "Usar este enfoque".');
      return;
    }
    setError('');
    if (activeAgents.length === 0) {
      setError('No hay agentes activos en la base de datos. Actívalos en la vista Agentes.');
      return;
    }
    if (pipelineAgents.length === 0) {
      setError('No hay agentes seleccionados. Selecciona al menos uno en el panel de agentes.');
      return;
    }
    setStartingPlan(true);
    try {
      let newRunId = runId;
      if (!newRunId || steps.length === 0) {
        const planId = await createPlan({
          projectId: projectInfo.id ?? '',
          title: goal.slice(0, 80) || 'Ejecución por etapas',
          goal,
          content: plan,
        });
        setPlanId(planId);
        newRunId = await startPlanRun(planId);
        const stepIds = await createPlanSteps(
          newRunId,
          pipelineAgents.map((a) => ({
            agentId: a.id,
            agentName: a.name,
            role: a.role,
            modelName: a.model || selectedModel,
          }))
        );
        if (stepIds.length > 0) {
          const created = await fetchPlanSteps(newRunId);
          setSteps(created);
        }
      }
      setRunId(newRunId);
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar la ejecución por etapas. Revisa que haya un proyecto activo.');
    } finally {
      setStartingPlan(false);
    }
  };

  const handleDirectSend = async () => {
    if (!selectedModel || !directInput.trim() || directSending) return;
    const prompt = directInput.trim();
    setDirectInput('');
    setDirectMessages((prev) => [...prev, { role: 'user' as const, content: prompt }]);
    setDirectSending(true);
    setError('');
    let acc = '';
    const appendAssistant = (content: string) => {
      acc = content;
      setDirectMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', content };
        } else {
          next.push({ role: 'assistant', content });
        }
        return next;
      });
    };
    const sys = `Eres un ingeniero que construye el producto directamente sobre el proyecto.${ACTION_SPEC}\n\nPLAN TÉCNICO:\n${plan || 'Aún sin plan.'}`;
    const userMsg = `PROYECTO: ${projectInfo.name}\nRUTA: ${projectPath || 'No especificada'}\n\nOBJETIVO:\n${goal || 'No definido'}\n\nTAREA DEL USUARIO:\n${prompt}`;
    try {
      const result = await runAgentToolLoop({
        model: selectedModel,
        systemPrompt: sys,
        userPrompt: userMsg,
        projectPath,
        onText: (chunk) => appendAssistant(acc + chunk),
        onToolResult: (_action, _result, summary) => appendAssistant(acc + `\n${summary}`),
      });
      appendAssistant(result.finalText + result.summaries);
      await parseAndSaveMemoryJson(projectInfo.name, result.finalText).catch(() => undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error en la construcción directa con el modelo.');
    } finally {
      setDirectSending(false);
    }
  };

  const handleAudit = async () => {
    if (auditing) return;
    setAuditing(true);
    setAuditOutput('');
    const completed = steps.filter((s) => s.status === 'completed');
    const prevOutputs = completed.map((s) => `### ${s.agent_name}\n${s.output}`);
    const auditSys = 'Tech Auditor Lead. Analiza el trabajo del equipo, genera un resumen técnico y emite el bloque json_memory con la bitácora .md.';
    const auditPrompt = `PLAN:\n${plan}\n\nRESPUESTAS DEL EQUIPO:\n${prevOutputs.join('\n\n')}`;
    let accumulated = '';
    try {
      await streamChatCompletion(selectedModel, [
        { role: 'system', content: auditSys },
        { role: 'user', content: auditPrompt },
      ], (chunk) => {
        accumulated += chunk;
        setAuditOutput(accumulated);
      });
      await parseAndSaveMemoryJson(projectInfo.name, accumulated);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditing(false);
    }
  };

  const handleFinishRun = async () => {
    if (!runId) return;
    try {
      await finishPlanRun(runId, 'completed', (auditOutput || 'Sin auditoría').slice(0, 2000));
    } catch (err) {
      console.error(err);
    }
  };

  const currentStep = useMemo(
    () => steps.find((s) => s.status !== 'completed' && s.status !== 'cancelled'),
    [steps]
  );
  const allCompleted = steps.length > 0 && !currentStep;
  const completedSteps = steps.filter((s) => s.status === 'completed');

  useEffect(() => {
    if (isGeneratingPlan && planInputRef.current) {
      planInputRef.current.scrollTop = planInputRef.current.scrollHeight;
    }
  }, [plan, isGeneratingPlan]);

  useEffect(() => {
    if (runningStepId && runningCardRef.current) {
      runningCardRef.current.scrollIntoView({ block: 'nearest' });
      if (runningCardRef.current.scrollTop !== undefined) {
        runningCardRef.current.scrollTop = runningCardRef.current.scrollHeight;
      }
    }
  }, [steps, runningStepId]);

  useEffect(() => {
    if (auditing && auditOutputRef.current) {
      auditOutputRef.current.scrollIntoView({ block: 'nearest' });
      auditOutputRef.current.scrollTop = auditOutputRef.current.scrollHeight;
    }
  }, [auditOutput, auditing]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <Sparkles className="w-8 h-8 text-sky-500 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Ejecución de Planes</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Genera y ejecuta planes por etapas, con revisión del usuario</p>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-mono text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {projectInfo.path && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-blue-500/10 border border-sky-200 dark:border-blue-500/30 rounded-lg text-xs font-mono">
          <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-blue-400" />
          <span className="text-sky-700 dark:text-blue-300">Proyecto activo: <strong>{projectInfo.path}</strong></span>
          <span className="text-sky-500 dark:text-blue-400 ml-1">(Python activo)</span>
        </div>
      )}

      {/* Modo de ejecución */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Modo de construcción:</span>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setExecutionMode('agents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs transition ${
              executionMode === 'agents'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-transparent'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Ejecutar Agentes
          </button>
          <button
            onClick={() => setExecutionMode('model')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs transition ${
              executionMode === 'model'
                ? 'bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Directamente con el Modelo
          </button>
        </div>
        <span className="text-[10px] font-mono text-zinc-400">
          {executionMode === 'agents'
            ? 'Orquesta los agentes del proyecto por etapas (revisión manual)'
            : 'El modelo construye directamente sobre el proyecto, ejecutando acciones de Python'}
        </span>
      </div>

      {/* Aprobaciones pendientes (acciones de escritura/borrado) */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-3">
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300 mb-1">{approval.title}</h3>
                  <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">{approval.description}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded transition text-xs font-mono"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition text-xs font-mono"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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

        {isGeneratingPlan && (
          <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Pensando… Escribiendo plan con IA… ({plan.length} caracteres)
          </div>
        )}

        {plan && (
          <div className="mt-4">
            <label className="block font-mono text-xs text-zinc-500 dark:text-zinc-400 mb-1">Plan Confirmado:</label>
            <AutoTextarea
              ref={planInputRef}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none resize-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleConfirmPlan}
                disabled={!plan || planConfirmed}
                className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Usar este enfoque
              </button>
              {planConfirmed && (
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  Enfoque confirmado ✓ — puedes iniciar las etapas
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 1.5 Selección de Agentes del Pipeline */}
      {executionMode === 'agents' && (
      <section className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-mono font-semibold text-amber-600 dark:text-emerald-400 flex items-center gap-2">
            <Users className="w-5 h-5" /> Selección de Agentes del Pipeline
          </h2>
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {pipelineAgents.length} / {activeAgents.length} seleccionados
          </span>
        </div>

        {activeAgents.length === 0 ? (
          <p className="text-xs font-mono text-rose-500">
            No hay agentes activos. Actívalos desde la vista Agentes para poder orquestarlos.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {orderedByRole.map((agent) => {
                const selected = selectedAgentIds.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleSelectAgent(agent.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${
                      selected
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                        : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-emerald-500/30'
                    }`}
                  >
                    <input type="checkbox" checked={selected} readOnly className="mt-0.5 accent-emerald-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-100 truncate">{agent.name}</p>
                      <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                        {agent.role}
                        {agent.model ? ` · ${agent.model}` : ` · modelo global (${selectedModel || 'sin definir'})`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {pipelineAgents.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Orden de orquestación por funcionalidad (arrastra para reordenar)
              </p>
              <ol className="space-y-1 list-decimal list-inside">
                {pipelineAgents.map((agent, idx) => (
                  <li
                    key={agent.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      if (!Number.isNaN(from) && from !== idx) moveAgentDrag(from, idx);
                    }}
                    className={`flex items-center justify-between text-xs font-mono rounded-lg border border-transparent transition ${
                      idx === 0
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <span
                        className="cursor-move text-zinc-400 dark:text-zinc-500"
                        aria-hidden="true"
                        title="Arrastra para reordenar"
                      >
                        ≡
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">{idx + 1}.</span> {agent.name}
                      <span className="text-zinc-500 dark:text-zinc-500"> ({agent.role})</span>
                    </span>
                    <span className="flex gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => moveAgent(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveAgent(idx, 1)}
                        disabled={idx === pipelineAgents.length - 1}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            )}
          </>
        )}
      </section>
      )}

      {/* 2. Ejecución por etapas */}
      {executionMode === 'agents' && plan && (
        <section className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400">2️⃣ Ejecución por Etapas (revisión manual)</h2>
            {steps.length === 0 && (
              <button
                onClick={handleStartStaged}
                disabled={startingPlan || pipelineAgents.length === 0 || !planConfirmed}
                className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-5 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={planConfirmed ? '' : 'Confirma primero el enfoque del plan'}
              >
                {startingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Iniciar etapas
              </button>
            )}
          </div>

          {steps.length === 0 && !startingPlan && (
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              Ejecuta los agentes uno a la vez. Al terminar cada agente, revisa su texto y marca cuándo está listo para pasar al siguiente.
            </p>
          )}

          <div className="space-y-4 mt-2">
            {steps.map((step, idx) => {
              const status = STEP_STATUS[step.status] ?? STEP_STATUS.pending;
              const isCurrent = currentStep?.id === step.id;
              const isRunning = runningStepId === step.id;
              return (
                <div
                  key={step.id}
                  ref={isRunning ? runningCardRef : undefined}
                  className={`border rounded-xl p-4 font-mono text-xs ${isCurrent ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60'}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                        {step.status === 'completed' ? '✓' : idx + 1}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-200 font-bold">{step.agent_name}</span>
                      {step.role && <span className="text-zinc-500">{step.role}</span>}
                      {step.model_name && (
                        <span className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-0.5">{step.model_name}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${status.cls}`}>{status.label}</span>
                  </div>

                  {/* Acciones de ejecución */}
                  {step.status === 'pending' && isCurrent && !isRunning && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => runAgent(step, '')}
                        className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-xs transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Ejecutar agente
                      </button>
                      <p className="text-[10px] text-zinc-500">Este es el agente actual. Púlsalo para que trabaje sobre el plan.</p>
                    </div>
                  )}

                  {step.status === 'pending' && !isCurrent && !isRunning && (
                    <p className="text-[10px] text-zinc-400">Espera a que los pasos anteriores estén aprobados.</p>
                  )}

                  {/* Output en tiempo real */}
                  {(step.status === 'running' || step.status === 'needs_approval' || step.status === 'completed' || step.status === 'error') && (
                    <div className="mt-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                      {step.status === 'running' ? (
                        <div className="whitespace-pre-wrap break-words font-sans text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed min-h-4">
                          {step.output || (
                            <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ejecutando…
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words font-sans text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {step.output || 'Sin salida.'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Revisión del usuario */}
                  {step.status === 'needs_approval' && (
                    <div className="mt-3 space-y-3">
                      <p className="flex items-center gap-1.5 text-sky-600 dark:text-blue-400 font-mono text-[10px]">
                        <AlertTriangle className="w-3.5 h-3.5" /> Revisa la respuesta. Decide si está lista o indícale los siguientes pasos.
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleMarkCompleted(step)}
                          className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-xs transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tarea completada — avanzar al siguiente
                        </button>
                        <button
                          onClick={() => runAgent(step, feedbackMapRef.current[step.id] ?? '')}
                          className="flex items-center gap-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 px-4 py-2 rounded-lg font-mono text-xs transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                        </button>
                      </div>
                      <label className="block font-mono text-[10px] text-zinc-500">Comentarios / siguientes pasos para el agente</label>
                      <AutoTextarea
                        value={feedbackMapRef.current[step.id] ?? ''}
                        onChange={(e) => { feedbackMapRef.current[step.id] = e.target.value; setSteps([...steps]); }}
                        placeholder="Ej: faltó cubrir el caso de error, añade tests para X…"
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 font-sans text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {step.status === 'cancelled' && (
                    <p className="text-[10px] text-zinc-500">Etapa cancelada.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finalización */}
          {allCompleted && steps.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
              {!auditOutput && !auditing ? (
                <button
                  onClick={handleAudit}
                  className="flex items-center gap-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-300 dark:border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-5 py-2 rounded-lg font-mono text-sm transition"
                >
                  {auditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generar auditoría final
                </button>
              ) : (
                  <div className="space-y-3">
                   <div
                     ref={auditOutputRef}
                     className="whitespace-pre-wrap break-words bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 font-sans text-xs text-zinc-700 dark:text-zinc-300"
                   >
                     {auditOutput || 'Auditoría en curso…'}
                  </div>
                  <button
                    onClick={handleFinishRun}
                    className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-5 py-2 rounded-lg font-mono text-sm transition"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Cerrar corrida del plan
                  </button>
                </div>
              )}
            </div>
          )}

          {steps.length > 0 && completedSteps.length > 0 && (
            <p className="text-[10px] font-mono text-zinc-500">
              {completedSteps.length} de {steps.length} etapas completadas
            </p>
          )}
        </section>
      )}

      {/* 2b. Construcción directa con el modelo */}
      {executionMode === 'model' && plan && (
        <section className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-mono font-semibold text-amber-600 dark:text-emerald-400">2️⃣ Construcción Directa (el modelo ejecuta)</h2>
            <span className="text-[10px] font-mono text-zinc-400">
              {projectPath ? `Ruta: ${projectPath}` : 'Sin ruta de proyecto definida'}
            </span>
          </div>

          <p className="text-xs font-sans text-zinc-500 dark:text-zinc-400">
            En este modo el modelo construye el producto directamente sobre la ruta del proyecto, ejecutando
            acciones de Python (crear/editar archivos, instalar dependencias, ejecutar scripts, verificar con tests).
            Si no hay ruta definida, el modelo solo te explicará el plan sin tocar el disco.
          </p>

          {/* Mini-chat de construcción */}
          <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {directMessages.length === 0 && (
                <p className="text-xs font-mono text-zinc-400 text-center pt-10">
                  Pide al modelo que implemente una parte del plan. Ej: "Crea los modelos de base de datos" o "Implementa la autenticación".
                </p>
              )}
              {directMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words border ${
                      msg.role === 'user'
                        ? 'bg-sky-50 dark:bg-blue-500/10 border-sky-200 dark:border-blue-500/30 text-sky-800 dark:text-sky-200'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {directSending && (
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> Ejecutando acciones en el proyecto…
                </div>
              )}
            </div>
            <div className="flex gap-2 border-t border-zinc-200 dark:border-zinc-800 p-3">
              <input
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleDirectSend();
                  }
                }}
                placeholder="Instrucción de construcción para el modelo…"
                className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-amber-400 dark:focus:border-emerald-500/50"
              />
              <button
                onClick={handleDirectSend}
                disabled={directSending || !directInput.trim()}
                className="flex items-center gap-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};