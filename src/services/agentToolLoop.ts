/**
 * Bucle de herramientas estilo OpenCode para agentes de Planes.
 * El modelo emite bloques <action> DURANTE el streaming; el sistema los ejecuta
 * (escribir/leer/interactuar con el proyecto vía Python) y reinyecta los
 * resultados al modelo para que continúe la conversación.
 */
import { streamChatCompletion } from './ollama';
import {
  executeAction,
  stripActionsFromResponse,
  formatActionResult,
  type ActionData,
  type ActionResult,
} from './fileActions';
import { approvalSystem } from './approvalSystem';
import { saveChatAction } from './apiDb';
import type { ChatMessage } from '../types';

const SENSITIVE_ACTIONS = new Set(['write_file', 'create_file', 'delete_file', 'append_file']);

export const ACTION_SPEC = `
Puedes realizar operaciones de archivos dentro del proyecto usando bloques <action> que se ejecutan automáticamente (Python) y cuyo resultado vuelve a ti para continuar.

Acciones disponibles:
- write_file / create_file: Crear o sobrescribir un archivo (path, content)
- read_file: Leer el contenido de un archivo (path)
- append_file: Añadir contenido al final de un archivo (path, content)
- delete_file: Eliminar un archivo (path)
- create_directory / mkdir: Crear un directorio (path)
- list_files: Listar archivos en un directorio (path)
- get_file_info / stat: Obtener información de un archivo (path)

Ejemplo:
<action>
{"action": "write_file", "path": "src/components/Componente.tsx", "content": "// contenido del archivo"}
</action>

Cuando necesites el resultado de una acción para decidir el siguiente paso, emite la acción y espera su RESULTADO DE ACCIÓN antes de continuar.`;

export interface ToolResultEntry {
  action: ActionData;
  result: ActionResult;
  summary: string;
}

export interface ToolLoopResult {
  /** Texto final del asistente sin los bloques <action>. */
  finalText: string;
  /** Texto crudo (incluye los bloques <action> emitidos). */
  rawText: string;
  summaries: string;
  toolResults: ToolResultEntry[];
}

export interface AgentToolLoopOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  projectPath?: string;
  /** id de plan_step para registrar las acciones en chat_actions. */
  recordMessageId?: string;
  onText?: (chunk: string) => void;
  onToolResult?: (action: ActionData, result: ActionResult, summary: string) => void;
  maxIterations?: number;
}

interface ParsedAction {
  action: ActionData;
  end: number;
}

const extractCompleteActions = (text: string, fromIndex: number): ParsedAction[] => {
  const regex = /<action>\s*({[\s\S]*?})\s*<\/action>/g;
  regex.lastIndex = fromIndex;
  const out: ParsedAction[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.action && parsed.path) {
        out.push({
          action: { action: parsed.action, path: parsed.path, content: parsed.content || '' },
          end: regex.lastIndex,
        });
      }
    } catch (e) {
      console.error('No se pudo parsear la acción:', match[1], e);
    }
  }
  return out;
};

const executeWithApproval = async (action: ActionData, projectPath: string): Promise<ActionResult> => {
  if (!projectPath) {
    return { success: false, error: 'No hay un proyecto activo con ruta para ejecutar acciones.' };
  }
  if (SENSITIVE_ACTIONS.has(action.action)) {
    try {
      const approval = await approvalSystem.requestApproval({
        type: 'file_edit',
        title: `${action.action === 'delete_file' ? 'Eliminar' : 'Modificar'} archivo`,
        description: `El agente solicita ${action.action === 'delete_file' ? 'eliminar' : 'escribir'} \`${action.path}\` en el proyecto.`,
        details: {
          files: [action.path],
          riskLevel: action.action === 'delete_file' ? 'high' : 'medium',
        },
      });
      if (approval.decision === 'rejected') {
        return {
          success: false,
          error: `Acción rechazada por el usuario: ${approval.feedback || 'sin comentarios'}`,
        };
      }
    } catch (error) {
      console.warn('Error en flujo de aprobación, se ejecuta por defecto:', error);
    }
  }
  return executeAction(action, projectPath);
};

export const runAgentToolLoop = async (options: AgentToolLoopOptions): Promise<ToolLoopResult> => {
  const { model, systemPrompt, userPrompt, projectPath, recordMessageId, onText, onToolResult } = options;
  const maxIterations = options.maxIterations ?? 6;

  // Inyectar la especificación de <action> si el agente no la conoce todavía
  const specInjected = (systemPrompt + userPrompt).includes('<action');
  const effectiveUserPrompt = specInjected ? userPrompt : `${userPrompt}\n\n${ACTION_SPEC}`;

  let rawText = '';
  const toolResults: ToolResultEntry[] = [];
  const summaries: string[] = [];

  let messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: effectiveUserPrompt },
  ];

  for (let iter = 0; iter < maxIterations; iter++) {
    let pendingText = '';
    await streamChatCompletion(model, messages, (chunk) => {
      pendingText += chunk;
      rawText += chunk;
      onText?.(chunk);
    });

    const actions = extractCompleteActions(pendingText, 0);
    if (actions.length === 0) break;

    messages.push({ role: 'assistant', content: pendingText });

    for (const { action } of actions) {
      const result = await executeWithApproval(action, projectPath ?? '');
      const summary = formatActionResult(action, result);
      summaries.push(summary);
      toolResults.push({ action, result, summary });
      onToolResult?.(action, result, summary);

      if (recordMessageId) {
        saveChatAction({
          messageId: recordMessageId,
          actionName: action.action,
          targetPath: action.path,
          payload: { content: action.content },
          status: result.success ? 'success' : 'error',
          result: { success: result.success, error: result.error ?? null },
        }).catch(() => undefined);
      }

      messages.push({
        role: 'user',
        content:
          `RESULTADO DE ACCIÓN (${action.action} \`${action.path}\`):\n` +
          `${result.success ? JSON.stringify(result.result ?? 'OK') : `ERROR: ${result.error}`}\n` +
          `Continúa trabajando. Si necesitas otra acción, emítela en un bloque <action>. Cuando termines, responde al usuario.`,
      });
    }
  }

  const finalText = stripActionsFromResponse(rawText);
  const summariesText = summaries.length > 0 ? `\n\n---\n### 📋 Acciones ejecutadas:\n\n${summaries.join('\n\n')}` : '';

  return { finalText, rawText, summaries: summariesText, toolResults };
};
