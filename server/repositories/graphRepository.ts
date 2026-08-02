import { queryAll, execute } from './db';
import type { GraphNodeRow } from '../core/types';

export const listGraphNodes = async (projectName: string): Promise<GraphNodeRow[]> => {
  return (await queryAll(
    'SELECT * FROM graph_nodes WHERE project_name = ? ORDER BY updated_at DESC',
    [projectName]
  )) as unknown as GraphNodeRow[];
};

export const upsertGraphNode = async (node: {
  id: string;
  project_name: string;
  node_type: string;
  title: string;
  content: string;
}): Promise<void> => {
  await execute(
    `INSERT INTO graph_nodes (id, project_name, node_type, title, content, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       node_type = excluded.node_type,
       title = excluded.title,
       content = excluded.content,
       updated_at = CURRENT_TIMESTAMP`,
    [node.id, node.project_name, node.node_type, node.title, node.content]
  );
};
