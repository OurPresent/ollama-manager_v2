import { GraphNode, TaskLog } from '../types';

const GRAPH_NODES_KEY = 'llmx_graph_nodes';
const TASK_LOGS_KEY = 'llmx_task_logs';

export const getGraphNodes = (projectName?: string): GraphNode[] => {
  const data = localStorage.getItem(GRAPH_NODES_KEY);
  const nodes: GraphNode[] = data ? JSON.parse(data) : [];
  if (projectName && projectName !== 'Todos') {
    return nodes.filter((n) => n.projectName === projectName);
  }
  return nodes;
};

export const saveGraphNode = (node: GraphNode): void => {
  const nodes = getGraphNodes();
  const index = nodes.findIndex((n) => n.id === node.id);
  if (index >= 0) {
    nodes[index] = node;
  } else {
    nodes.push(node);
  }
  localStorage.setItem(GRAPH_NODES_KEY, JSON.stringify(nodes));
};

export const getTaskLogs = (projectName?: string): TaskLog[] => {
  const data = localStorage.getItem(TASK_LOGS_KEY);
  const logs: TaskLog[] = data ? JSON.parse(data) : [];
  if (projectName && projectName !== 'Todos') {
    return logs.filter((l) => l.projectName === projectName);
  }
  return logs;
};

export const saveTaskLog = (log: TaskLog): void => {
  const logs = getTaskLogs();
  const index = logs.findIndex((l) => l.taskId === log.taskId);
  if (index >= 0) {
    logs[index] = log;
  } else {
    logs.unshift(log);
  }
  localStorage.setItem(TASK_LOGS_KEY, JSON.stringify(logs));
};

export const parseAndSaveMemoryJson = (projectName: string, rawResponse: string): boolean => {
  if (!rawResponse.includes('```json_memory')) return false;

  try {
    const jsonStr = rawResponse.split('```json_memory')[1].split('```')[0].trim();
    const memoryData = JSON.parse(jsonStr);

    if (memoryData.bitacora_md) {
      const b = memoryData.bitacora_md;
      saveTaskLog({
        taskId: b.id || `TASK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        projectName,
        title: b.titulo || 'Sin Título',
        markdownContent: b.contenido || '',
        tags: b.tags || [],
        createdAt: new Date().toISOString(),
      });
    }

    if (Array.isArray(memoryData.nodos_actualizar)) {
      memoryData.nodos_actualizar.forEach((n: any) => {
        if (n.id) {
          saveGraphNode({
            id: n.id,
            projectName,
            nodeType: n.tipo || 'ENTIDAD',
            title: n.nombre || 'Sin Nombre',
            content: n.contenido || '',
            updatedAt: new Date().toISOString(),
          });
        }
      });
    }

    return true;
  } catch (e) {
    console.error('Error parseando bloque json_memory:', e);
    return false;
  }
};