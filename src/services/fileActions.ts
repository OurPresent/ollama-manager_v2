/**
 * Service for detecting and executing file actions from LLM responses.
 * The LLM can include <action> blocks in its responses to perform file operations
 * within the active project directory via Python.
 */

import { approvalSystem } from './approvalSystem';

interface ActionData {
  action: string;
  path: string;
  content?: string;
}

interface ActionResult {
  success: boolean;
  result?: string | string[] | Record<string, unknown>;
  error?: string;
}

/**
 * Parse an LLM response to extract action blocks.
 * Actions are wrapped in <action>...</action> tags with JSON content.
 */
export function parseActionsFromResponse(response: string): ActionData[] {
  const actions: ActionData[] = [];
  const regex = /<action>\s*({[\s\S]*?})\s*<\/action>/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.action && parsed.path) {
        actions.push({
          action: parsed.action,
          path: parsed.path,
          content: parsed.content || '',
        });
      }
    } catch (e) {
      console.error('Failed to parse action JSON:', match[1], e);
    }
  }

  return actions;
}

/**
 * Remove action blocks from the response text for display.
 */
export function stripActionsFromResponse(response: string): string {
  return response.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
}

/**
 * Execute a single action via the backend API.
 */
export async function executeAction(
  actionData: ActionData,
  projectPath: string
): Promise<ActionResult> {
  try {
    const res = await fetch('/api/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: actionData.action,
        project_path: projectPath,
        path: actionData.path,
        content: actionData.content || '',
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: errorData.error || `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (error: unknown) {
    return { success: false, error: `Connection error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Execute all actions found in a response and return the results.
 * Actions are executed sequentially in order.
 * Sensitive actions (write/create/delete/append) require approval first.
 */
const SENSITIVE_ACTIONS = new Set(['write_file', 'create_file', 'delete_file', 'append_file']);

export async function executeAllActions(
  response: string,
  projectPath: string
): Promise<{ cleanResponse: string; results: { action: ActionData; result: ActionResult }[] }> {
  const actions = parseActionsFromResponse(response);
  const cleanResponse = stripActionsFromResponse(response);
  const results: { action: ActionData; result: ActionResult }[] = [];

  for (const action of actions) {
    // Solicitar aprobación para acciones sensibles
    if (SENSITIVE_ACTIONS.has(action.action)) {
      try {
        const approval = await approvalSystem.requestApproval({
          type: 'file_edit',
          title: `${action.action === 'delete_file' ? 'Eliminar' : 'Modificar'} archivo`,
          description: `Se solicita ${action.action === 'delete_file' ? 'eliminar' : 'escribir'} \`${action.path}\` en el proyecto.`,
          details: {
            files: [action.path],
            riskLevel: action.action === 'delete_file' ? 'high' : 'medium',
          },
        });

        if (approval.decision === 'rejected') {
          results.push({
            action,
            result: {
              success: false,
              error: `Acción rechazada por el usuario: ${approval.feedback || 'sin comentarios'}`,
            },
          });
          continue;
        }
      } catch (error) {
        console.warn('Error en flujo de aprobación, se ejecuta por defecto:', error);
      }
    }

    const result = await executeAction(action, projectPath);
    results.push({ action, result });
  }

  return { cleanResponse, results };
}

/**
 * Get a human-readable summary of an action result.
 */
export function formatActionResult(action: ActionData, result: ActionResult): string {
  const actionLabels: Record<string, string> = {
    read_file: '📖 Leer archivo',
    write_file: '✏️ Escribir archivo',
    create_file: '📄 Crear archivo',
    delete_file: '🗑️ Eliminar archivo',
    list_files: '📂 Listar archivos',
    create_directory: '📁 Crear directorio',
    mkdir: '📁 Crear directorio',
    append_file: '📝 Añadir a archivo',
    get_file_info: 'ℹ️ Info de archivo',
    stat: 'ℹ️ Info de archivo',
  };

  const label = actionLabels[action.action] || `⚙️ ${action.action}`;
  const path = action.path;
  const status = result.success ? '✅ Éxito' : '❌ Error';

  let detail = '';
  if (result.success && result.result) {
    if (typeof result.result === 'string') {
      detail = result.result.length > 100 ? result.result.substring(0, 100) + '...' : result.result;
    } else if (Array.isArray(result.result)) {
      detail = `${result.result.length} archivos encontrados`;
    }
  } else if (!result.success && result.error) {
    detail = result.error;
  }

  return `### ${label} — \`${path}\` ${status}\n${detail ? `\n\`\`\`\n${detail}\n\`\`\`` : ''}`;
}
