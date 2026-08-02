import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, ProjectInfo } from '../types';
import { streamChatCompletion } from '../services/ollama';
import { parseAndSaveMemoryJson } from '../services/memoryDb';
import { fetchGraphNodes, fetchTaskLogs, saveProjectQuery, fetchProjectFiles, fetchFileContent, indexProjectFiles } from '../services/apiDb';
import { executeAllActions, formatActionResult } from '../services/fileActions';
import { Send, Bot, User, Code, Loader2, Plus, AlertTriangle, CheckCircle, XCircle, FileCode, Trash2, RefreshCw } from 'lucide-react';
import { approvalSystem, ApprovalRequest } from '../services/approvalSystem';
import { fileReferenceSystem } from '../services/fileReference';
import { useChatStore } from '../store/chatStore';
import { FileAutocomplete } from '../components/FileAutocomplete';

interface Props {
  selectedModel: string;
  projectInfo: ProjectInfo;
  projectContext: string;
  setProjectContext: (ctx: string) => void;
}

interface ActionExecution {
  index: number;
  summary: string;
  success: boolean;
}

export const ChatView: React.FC<Props> = ({ selectedModel, projectInfo, projectContext, setProjectContext }) => {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [executingActions, setExecutingActions] = useState(false);
  const [actionResults, setActionResults] = useState<ActionExecution[]>([]);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [indexingFiles, setIndexingFiles] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    sessions,
    messagesBySession,
    currentSessionId,
    loadSessions,
    createSession,
    switchSession,
    removeSession,
    setMessages,
    persistMessage,
  } = useChatStore();

  const messages = currentSessionId ? messagesBySession[currentSessionId] ?? [] : [];

  // Load persisted sessions from SQLite on mount / project change
  useEffect(() => {
    loadSessions(projectInfo.id);
  }, [loadSessions, projectInfo.id]);

  // Load project files from the backend index (Fase 2.4)
  const loadProjectFiles = useCallback(async () => {
    if (!projectInfo.id) return;
    try {
      const files = await fetchProjectFiles(projectInfo.id);
      const paths = files.map((f) => f.relativePath);
      setProjectFiles(paths);
      fileReferenceSystem.setProjectFiles(projectInfo.name, paths);
    } catch (err) {
      console.error('Error loading project files:', err);
      setProjectFiles([]);
    }
  }, [projectInfo.id, projectInfo.name]);

  useEffect(() => {
    loadProjectFiles();
  }, [loadProjectFiles]);

  // Subscribe to approval system pending requests
  useEffect(() => {
    return approvalSystem.subscribe(setPendingApprovals);
  }, []);

  const handleApprovalDecision = (requestId: string, decision: 'approved' | 'rejected' | 'alternative', selectedAlternative?: number) => {
    approvalSystem.resolveApproval(requestId, decision, selectedAlternative);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, executingActions]);

  const createNewChat = () => {
    createSession('Nuevo Chat', projectInfo.id, selectedModel);
  };

  const handleReindexFiles = async () => {
    if (!projectInfo.id || indexingFiles) return;
    setIndexingFiles(true);
    try {
      await indexProjectFiles(projectInfo.id);
      await loadProjectFiles();
    } catch (err) {
      console.error('Error reindexing project files:', err);
    } finally {
      setIndexingFiles(false);
    }
  };

  const handleSwitchSession = async (sessionId: string) => {
    await switchSession(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await removeSession(sessionId);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    if (!selectedModel || isStreaming) return;

    // Create a new session if none exists
    let sessionId = currentSessionId;
    if (!sessionId) {
      const created = await createSession(
        input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        projectInfo.id,
        selectedModel
      );
      sessionId = created?.id ?? null;
      if (!sessionId) return;
    }

    const sessionMessages = messagesBySession[sessionId] ?? [];

    // Process file references (using $ syntax) — carga contenido real desde el índice del backend
    const { references } = fileReferenceSystem.parseFileReferences(input);
    if (projectInfo.id && references.length > 0) {
      for (const ref of references) {
        try {
          const file = await fetchFileContent(projectInfo.id, ref);
          fileReferenceSystem.setFileContent(file.path, file.content);
        } catch (err) {
          console.warn(`No se pudo cargar "${ref}":`, err);
        }
      }
    }
    const { enrichedMessage, fileContents } = await fileReferenceSystem.enrichMessageWithFiles(input, projectInfo.name);

    const userMsg: ChatMessage = { role: 'user', content: enrichedMessage };
    const newMessages = [...sessionMessages, userMsg];
    setMessages(sessionId, newMessages);
    setInput('');
    setIsStreaming(true);

    // Persist the user message
    const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await persistMessage(sessionId, userMsg, userMessageId);

    // Obtener contexto de memoria desde la base de datos SQLite
    const graphNodes = await fetchGraphNodes(projectInfo.name).catch(() => []);
    const taskLogs = await fetchTaskLogs(projectInfo.name).catch(() => []);

    let memoryContextStr = '=== MEMORIA DE GRAFO ===\n';
    graphNodes.forEach((n) => {
      memoryContextStr += `- [${n.nodeType}] ${n.title}: ${n.content}\n`;
    });

    memoryContextStr += '\n=== ÚLTIMA BITÁCORA MD ===\n';
    if (taskLogs.length > 0) {
      memoryContextStr += `${taskLogs[0].title}:\n${taskLogs[0].markdownContent}\n`;
    }

    // Add file contents to context if any were referenced
    let fileContextStr = '';
    if (fileContents.length > 0) {
      fileContextStr = '\n=== ARCHIVOS REFERENCIADOS ===\n';
      fileContents.forEach((fileRef) => {
        fileContextStr += `\n--- ${fileRef.path} ---\n${fileRef.content}\n`;
      });
    }

    const projectPath = projectInfo.path || projectInfo.name;

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `Eres un asistente experto de arquitectura para el proyecto "${projectInfo.name}".

Ruta completa del proyecto: ${projectPath || 'No especificada'}

${memoryContextStr}

=== CÓDIGO FUENTE ===
${projectContext}${fileContextStr}

CAPACIDADES DEL SISTEMA:
Puedes realizar operaciones de archivos dentro del proyecto usando bloques <action> que serán ejecutados automáticamente por Python.

Acciones disponibles:
- write_file: Crear o sobrescribir un archivo (requiere: path, content)
- create_file: Crear un archivo nuevo (requiere: path, content)
- read_file: Leer el contenido de un archivo (requiere: path)
- append_file: Añadir contenido al final de un archivo (requiere: path, content)
- delete_file: Eliminar un archivo (requiere: path)
- create_directory / mkdir: Crear un directorio (requiere: path)
- list_files: Listar archivos en un directorio (requiere: path)
- get_file_info / stat: Obtener información de un archivo (requiere: path)

Ejemplo de uso:
<action>
{"action": "write_file", "path": "src/components/Componente.tsx", "content": "// contenido del archivo"}
</action>

REGLA: Si la respuesta define una nueva decisión relevante, incluye al final un bloque \`\`\`json_memory { ... } \`\`\` para actualizar el Grafo.

INSTRUCCIÓN: Cuando el usuario use el signo $ para referirse a archivos (ej: $archivo.ts), el sistema automáticamente incluirá el contenido de esos archivos en el contexto.`
    };

    let assistantContent = '';
    const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messagesWithAssistant = [...newMessages, { role: 'assistant' as const, content: '' }];
    setMessages(sessionId, messagesWithAssistant);

    try {
      await streamChatCompletion(
        selectedModel,
        [systemPrompt, ...newMessages],
        (chunk) => {
          assistantContent += chunk;
          const updated = [...messagesWithAssistant];
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          setMessages(sessionId, updated);
        }
      );

      // Ejecutar acciones del sistema (Python) si hay projectPath
      let finalContent = assistantContent;
      if (projectPath) {
        setExecutingActions(true);
        const { cleanResponse, results } = await executeAllActions(assistantContent, projectPath);

        if (results.length > 0) {
          const actionSummaries = results.map((r, i) => {
            const summary = formatActionResult(r.action, r.result);
            return { index: i, summary, success: r.result.success };
          });
          setActionResults(actionSummaries);

          let actionResultsText = '\n\n---\n### 📋 Resultados de acciones ejecutadas:\n\n';
          actionSummaries.forEach((s) => {
            actionResultsText += s.summary + '\n\n';
          });
          finalContent = cleanResponse + actionResultsText;
        }
        setExecutingActions(false);
      }

      const updated = [...messagesWithAssistant];
      updated[updated.length - 1] = { role: 'assistant', content: finalContent };
      setMessages(sessionId, updated);

      await persistMessage(sessionId, { role: 'assistant', content: finalContent }, assistantMessageId);

      // Parsear si el modelo emitió actualizaciones de memoria
      await parseAndSaveMemoryJson(projectInfo.name, finalContent);

      // Registrar la consulta en project_queries (historial de consultas)
      try {
        await saveProjectQuery({
          projectName: projectInfo.name,
          title: `Consulta: ${input.slice(0, 50)}${input.length > 50 ? '...' : ''}`,
          rawQuery: input,
          optimizedQuery: finalContent,
        });
      } catch (error) {
        console.error('Error saving project query:', error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      setExecutingActions(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-7xl mx-auto p-6 text-zinc-800 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100">💬 Chat Contextual del Proyecto</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Inyección de código e historial de memoria activo</p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={currentSessionId ?? ''}
                onChange={(e) => e.target.value && handleSwitchSession(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none max-w-[220px]"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || 'Nuevo Chat'}
                  </option>
                ))}
              </select>
              {currentSessionId && (
                <button
                  onClick={() => handleDeleteSession(currentSessionId)}
                  className="p-2 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 rounded transition"
                  title="Eliminar sesión actual"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 rounded-lg transition font-mono text-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="font-semibold">Nuevo Chat</span>
          </button>
        </div>
      </header>

      {/* Project path indicator */}
      {projectInfo.path && (
        <div className="my-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-blue-500/10 border border-sky-200 dark:border-blue-500/30 rounded-lg text-xs font-mono">
            <FileCode className="w-3.5 h-3.5 text-sky-500 dark:text-blue-400" />
            <span className="text-sky-700 dark:text-blue-300">Proyecto activo: <strong>{projectInfo.path}</strong></span>
            <span className="text-sky-500 dark:text-blue-400 ml-1">(Python activo)</span>
          </div>
        </div>
      )}

      {/* Editor rápido de contexto de código */}
      <div className="my-3 shrink-0">
        <details className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-mono">
          <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-emerald-400 flex items-center gap-1.5 font-semibold">
            <Code className="w-4 h-4" /> Inspeccionar / Editar Contexto de Código del Proyecto
          </summary>
          <textarea
            value={projectContext}
            onChange={(e) => setProjectContext(e.target.value)}
            placeholder="Pega aquí extractos de código o estructura de carpetas..."
            className="w-full h-28 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded mt-2 p-2 font-mono text-xs text-zinc-800 dark:text-zinc-300 focus:outline-none"
          />
        </details>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-3">
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300 mb-1">{approval.title}</h3>
                  <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">{approval.description}</p>

                  {approval.details.files && approval.details.files.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Archivos afectados:</p>
                      <ul className="text-xs font-mono text-zinc-500 dark:text-zinc-400 space-y-0.5">
                        {approval.details.files.map((file, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="text-amber-500 dark:text-amber-400">•</span> {file}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded transition text-xs font-mono"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition text-xs font-mono"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Executing Indicator */}
      {executingActions && (
        <div className="bg-sky-50 dark:bg-blue-500/10 border border-sky-200 dark:border-blue-500/30 rounded-lg p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-sky-500 dark:text-blue-400" />
          <span className="text-xs font-mono text-sky-700 dark:text-blue-300">Ejecutando acciones en el proyecto mediante Python...</span>
        </div>
      )}

      {/* Action Results */}
      {actionResults.length > 0 && !executingActions && (
        <div className="space-y-2">
          {actionResults.map((ar) => (
            <div
              key={ar.index}
              className={`p-2 rounded-lg text-xs font-mono ${
                ar.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {ar.success ? '✅' : '❌'} {ar.summary.split('\n')[0]}
            </div>
          ))}
        </div>
      )}

      {/* Area de Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 p-4 rounded-xl font-sans text-sm ${
              m.role === 'user'
                ? 'bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80 ml-12'
                : 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mr-12'
            }`}
          >
            {m.role === 'user' ? (
              <User className="w-5 h-5 text-amber-500 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Bot className="w-5 h-5 text-sky-500 dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
              {m.content || (isStreaming && idx === messages.length - 1 && <Loader2 className="w-4 h-4 animate-spin text-amber-500 dark:text-emerald-400" />)}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Input de Chat */}
      <div className="mt-4 shrink-0 flex gap-2">
        <FileAutocomplete
          files={projectFiles}
          value={input}
          onChange={setInput}
          triggerChar="$"
          disabled={isStreaming}
          onEnter={handleSend}
          placeholder="Escribe una consulta sobre la arquitectura o código... Usa $nombre-archivo para referenciar archivos"
          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
        />
        {projectInfo.id && (
          <button
            onClick={handleReindexFiles}
            disabled={indexingFiles}
            title="Reindexar archivos del proyecto"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-emerald-400 hover:border-amber-300 dark:hover:border-emerald-500/50 px-3 rounded-xl transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${indexingFiles ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim() || !selectedModel}
          className="bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 px-5 rounded-xl transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
