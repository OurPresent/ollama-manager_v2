import { GraphNode, TaskLog } from '../types';
import { saveGraphNodeToSqlite, saveTaskLogToSqlite } from './apiDb';

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
      await saveTaskLogToSqlite(log);
    }

    if (Array.isArray(memoryData.nodos_actualizar)) {
      const nodes: GraphNode[] = (memoryData.nodos_actualizar as MemoryNodePayload[])
        .filter((n) => n.id)
        .map((n) => ({ ...asGraphNode(n), projectName }));
      await Promise.all(nodes.map((node) => saveGraphNodeToSqlite(node)));
    }

    return true;
  } catch (e) {
    console.error('Error parseando bloque json_memory:', e);
    return false;
  }
};
