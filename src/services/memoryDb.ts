import { GraphNode, TaskLog } from '../types';
import { saveGraphNodeToSqlite, saveTaskLogToSqlite } from './apiDb';

const GRAPH_NODES_KEY = 'llmx_graph_nodes';
const TASK_LOGS_KEY = 'llmx_task_logs';

interface MemoryNodePayload {
  id?: string;
  tipo?: string;
  nombre?: string;
  contenido?: string;
}

const asGraphNode = (n: MemoryNodePayload): GraphNode => ({
  id: n.id || `NODE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  projectName: '',
  nodeType: (n.tipo as GraphNode['nodeType']) || 'ENTIDAD',
  title: n.nombre || 'Sin Nombre',
  content: n.contenido || '',
  updatedAt: new Date().toISOString(),
});

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

export const parseAndSaveMemoryJson = async (projectName: string, rawResponse: string): Promise<boolean> => {
  if (!rawResponse.includes('```json_memory')) return false;

  try {
    const jsonStr = rawResponse.split('```json_memory')[1].split('```')[0].trim();
    const memoryData = JSON.parse(jsonStr);

    if (memoryData.bitacora_md) {
      const b = memoryData.bitacora_md;
      const log: TaskLog = {
        taskId: b.id || `TASK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        projectName,
        title: b.titulo || 'Sin Título',
        markdownContent: b.contenido || '',
        tags: b.tags || [],
        createdAt: new Date().toISOString(),
      };
      saveTaskLog(log);
      await saveTaskLogToSqlite(log);
    }

    if (Array.isArray(memoryData.nodos_actualizar)) {
      const nodes: GraphNode[] = (memoryData.nodos_actualizar as MemoryNodePayload[])
        .filter((n) => n.id)
        .map((n) => ({ ...asGraphNode(n), projectName }));
      nodes.forEach(saveGraphNode);
      await Promise.all(nodes.map((node) => saveGraphNodeToSqlite(node)));
    }

    return true;
  } catch (e) {
    console.error('Error parseando bloque json_memory:', e);
    return false;
  }
};