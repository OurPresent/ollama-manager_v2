import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { streamChatCompletion } from '../services/ollama';
import { parseAndSaveMemoryJson, getGraphNodes, getTaskLogs } from '../services/memoryDb';
import { Send, Bot, User, Code, Loader2, Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { approvalSystem, ApprovalRequest } from '../services/approvalSystem';
import { fileReferenceSystem } from '../services/fileReference';
import { saveQueryLog } from '../services/apiDb';

interface Props {
  selectedModel: string;
  projectInfo: { name: string; path: string };
  projectContext: string;
  setProjectContext: (ctx: string) => void;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export const ChatView: React.FC<Props> = ({ selectedModel, projectInfo, projectContext, setProjectContext }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Setup approval system callback
  useEffect(() => {
    approvalSystem.setCallback(async (request) => {
      // Add to pending approvals
      setPendingApprovals(prev => [...prev, request]);
      
      // Return a promise that waits for user decision
      return new Promise((resolve) => {
        (window as any).__approvalResolve = resolve;
      });
    });
  }, []);

  const handleApprovalDecision = (requestId: string, decision: 'approved' | 'rejected' | 'alternative', selectedAlternative?: number) => {
    const resolve = (window as any).__approvalResolve;
    if (resolve) {
      resolve({
        requestId,
        decision,
        selectedAlternative,
      });
      (window as any).__approvalResolve = null;
    }
    setPendingApprovals(prev => prev.filter(p => p.id !== requestId));
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Nuevo Chat',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const updateCurrentSession = (updatedMessages: ChatMessage[]) => {
    if (!currentSessionId) return;
    setSessions(sessions.map(s => 
      s.id === currentSessionId ? { ...s, messages: updatedMessages } : s
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || isStreaming) return;

    // Create a new session if none exists
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
    }

    // Process file references (using $ syntax)
    const { enrichedMessage, fileContents } = await fileReferenceSystem.enrichMessageWithFiles(input, projectInfo.name);
    
    const userMsg: ChatMessage = { role: 'user', content: enrichedMessage };
    const newMessages = [...messages, userMsg];
    updateCurrentSession(newMessages);
    setInput('');
    setIsStreaming(true);

    // Obtener contexto de memoria desde la base de datos local
    const graphNodes = getGraphNodes(projectInfo.name);
    const taskLogs = getTaskLogs(projectInfo.name);

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

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `Eres un asistente experto de arquitectura para el proyecto "${projectInfo.name}".\n\nRuta completa del proyecto: ${projectInfo.path || 'No especificada'}\n\n${memoryContextStr}\n\n=== CÓDIGO FUENTE ===\n${projectContext}${fileContextStr}\n\nREGLA: Si la respuesta define una nueva decisión relevante, incluye al final un bloque \`\`\`json_memory { ... } \`\`\` para actualizar el Grafo.\n\nINSTRUCCIÓN: Cuando el usuario use el signo $ para referirse a archivos (ej: $archivo.ts), el sistema automáticamente incluirá el contenido de esos archivos en el contexto.`
    };

    let assistantContent = '';
    const messagesWithAssistant = [...newMessages, { role: 'assistant' as const, content: '' }];
    updateCurrentSession(messagesWithAssistant);

    try {
      await streamChatCompletion(
        selectedModel,
        [systemPrompt, ...newMessages],
        (chunk) => {
          assistantContent += chunk;
          const updated = [...messagesWithAssistant];
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          updateCurrentSession(updated);
        }
      );

      // Parsear si el modelo emitió actualizaciones de memoria
      parseAndSaveMemoryJson(projectInfo.name, assistantContent);
      
      // Guardar la consulta en la base de datos como markdown
      await saveQueryLog(projectInfo.name, input, assistantContent);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-7xl mx-auto p-6 text-zinc-100">
      <header className="border-b border-zinc-800 pb-3 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-mono font-bold">💬 Chat Contextual del Proyecto</h1>
          <p className="text-xs text-zinc-400">Inyección de código e historial de memoria activo</p>
        </div>
        <button
          onClick={createNewChat}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition font-mono text-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="font-semibold">Nuevo Chat</span>
        </button>
      </header>

      {/* Editor rápido de contexto de código */}
      <div className="my-3 shrink-0">
        <details className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 text-xs font-mono">
          <summary className="cursor-pointer text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5 font-semibold">
            <Code className="w-4 h-4" /> Inspeccionar / Editar Contexto de Código del Proyecto
          </summary>
          <textarea
            value={projectContext}
            onChange={(e) => setProjectContext(e.target.value)}
            placeholder="Pega aquí extractos de código o estructura de carpetas..."
            className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded mt-2 p-2 font-mono text-xs text-zinc-300 focus:outline-none"
          />
        </details>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-3">
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-mono font-bold text-amber-300 mb-1">{approval.title}</h3>
                  <p className="text-xs font-mono text-zinc-400 mb-2">{approval.description}</p>
                  
                  {approval.details.files && approval.details.files.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Archivos afectados:</p>
                      <ul className="text-xs font-mono text-zinc-400 space-y-0.5">
                        {approval.details.files.map((file, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="text-amber-400">•</span> {file}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {approval.details.changes && approval.details.changes.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Cambios propuestos:</p>
                      <ul className="text-xs font-mono text-zinc-400 space-y-0.5">
                        {approval.details.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400">•</span> {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {approval.details.alternatives && approval.details.alternatives.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Alternativas:</p>
                      <div className="space-y-1">
                        {approval.details.alternatives.map((alt, i) => (
                          <button
                            key={i}
                            onClick={() => handleApprovalDecision(approval.id, 'alternative', i)}
                            className="w-full text-left text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 transition"
                          >
                            {i + 1}. {alt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded transition text-xs font-mono"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleApprovalDecision(approval.id, 'rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded transition text-xs font-mono"
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

      {/* Area de Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 p-4 rounded-xl font-sans text-sm ${
              m.role === 'user' ? 'bg-zinc-900/80 border border-zinc-800/80 ml-12' : 'bg-zinc-950 border border-zinc-800 mr-12'
            }`}
          >
            {m.role === 'user' ? (
              <User className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Bot className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-200">
              {m.content || (isStreaming && idx === messages.length - 1 && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />)}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Input de Chat */}
      <div className="mt-4 shrink-0 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe una consulta sobre la arquitectura o código... Usa $nombre-archivo para referenciar archivos"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-5 rounded-xl transition flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};