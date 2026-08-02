import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';

export const upsertContextBlock = async (data: {
  projectId: string;
  blockType: string;
  title: string;
  content: string;
  source?: string;
}): Promise<void> => {
  await execute(
    `INSERT INTO project_context_blocks (id, project_id, block_type, title, content, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       source = excluded.source,
       updated_at = CURRENT_TIMESTAMP`,
    [
      createId('ctx'),
      data.projectId,
      data.blockType,
      data.title,
      data.content,
      data.source ?? 'indexer',
    ]
  );
};

export const clearContextBlocks = async (projectId: string): Promise<void> => {
  await execute('DELETE FROM project_context_blocks WHERE project_id = ?', [projectId]);
};

export const listContextBlocks = async (projectId: string): Promise<DbRow[]> => {
  return queryAll(
    'SELECT * FROM project_context_blocks WHERE project_id = ? ORDER BY block_type ASC, created_at ASC',
    [projectId]
  );
};

export const insertSnapshot = async (data: {
  projectId: string;
  fileCount: number;
  totalSizeBytes: number;
  snapshot: Record<string, unknown>;
}): Promise<string> => {
  const id = createId('snap');
  await execute(
    `INSERT INTO project_snapshots (id, project_id, file_count, total_size_bytes, snapshot_json)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.projectId, data.fileCount, data.totalSizeBytes, JSON.stringify(data.snapshot)]
  );
  return id;
};

export const getLatestSnapshot = async (projectId: string): Promise<DbRow | null> => {
  return queryOne(
    'SELECT * FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    [projectId]
  );
};
