import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';

export interface IndexedFile {
  id: string;
  projectId: string;
  relativePath: string;
  fileType: string;
  sizeBytes: number;
  modifiedAt: string | null;
  hash: string;
}

export const upsertIndexedFile = async (data: {
  projectId: string;
  relativePath: string;
  fileType: string;
  sizeBytes: number;
  modifiedAt: string | null;
  hash: string;
}): Promise<void> => {
  await execute(
    `INSERT INTO file_index (id, project_id, relative_path, file_type, size_bytes, modified_at, hash, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(project_id, relative_path) DO UPDATE SET
       file_type = excluded.file_type,
       size_bytes = excluded.size_bytes,
       modified_at = excluded.modified_at,
       hash = excluded.hash,
       updated_at = CURRENT_TIMESTAMP`,
    [
      createId('file'),
      data.projectId,
      data.relativePath,
      data.fileType,
      data.sizeBytes,
      data.modifiedAt,
      data.hash,
    ]
  );
};

export const clearProjectFiles = async (projectId: string): Promise<void> => {
  await execute('DELETE FROM file_index WHERE project_id = ?', [projectId]);
};

export const searchProjectFiles = async (
  projectId: string,
  query: string,
  limit = 50
): Promise<DbRow[]> => {
  const q = `%${query}%`;
  return queryAll(
    `SELECT relative_path, file_type, size_bytes, modified_at
     FROM file_index
     WHERE project_id = ? AND (relative_path LIKE ? OR file_type LIKE ?)
     ORDER BY CASE WHEN relative_path LIKE ? THEN 0 ELSE 1 END, relative_path ASC
     LIMIT ?`,
    [projectId, q, q, `${query}%`, limit]
  );
};

export const listProjectFiles = async (projectId: string): Promise<DbRow[]> => {
  return queryAll(
    'SELECT relative_path, file_type, size_bytes, modified_at FROM file_index WHERE project_id = ? ORDER BY relative_path ASC',
    [projectId]
  );
};

export const getIndexedFile = async (
  projectId: string,
  relativePath: string
): Promise<DbRow | null> => {
  return queryOne(
    'SELECT * FROM file_index WHERE project_id = ? AND relative_path = ? LIMIT 1',
    [projectId, relativePath]
  );
};

export const countProjectFiles = async (projectId: string): Promise<number> => {
  const row = await queryOne('SELECT COUNT(*) AS total FROM file_index WHERE project_id = ?', [projectId]);
  return Number((row as DbRow)?.total ?? 0);
};
