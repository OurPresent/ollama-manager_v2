import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';
import type { ProjectRow } from '../core/types';

export const listProjects = async (): Promise<ProjectRow[]> => {
  return (await queryAll(
    'SELECT * FROM projects ORDER BY is_active DESC, updated_at DESC, name ASC'
  )) as unknown as ProjectRow[];
};

export const getActiveProject = async (): Promise<ProjectRow | null> => {
  return (await queryOne('SELECT * FROM projects WHERE is_active = 1 LIMIT 1')) as unknown as ProjectRow | null;
};

export const getProjectById = async (id: string): Promise<ProjectRow | null> => {
  return (await queryOne('SELECT * FROM projects WHERE id = ? LIMIT 1', [id])) as unknown as ProjectRow | null;
};

export const getProjectByRootPath = async (rootPath: string): Promise<ProjectRow | null> => {
  return (await queryOne('SELECT * FROM projects WHERE root_path = ? LIMIT 1', [rootPath])) as unknown as ProjectRow | null;
};

export const insertProject = async (data: {
  name: string;
  rootPath: string;
  description: string;
}): Promise<string> => {
  const id = createId('project');
  await execute(
    `INSERT INTO projects (id, name, root_path, description, is_active, updated_at)
     VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    [id, data.name, data.rootPath, data.description]
  );
  return id;
};

export const updateProject = async (
  id: string,
  data: { name: string; description: string }
): Promise<void> => {
  await execute(
    `UPDATE projects
     SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.name, data.description, id]
  );
};

export const setAllProjectsInactive = async (): Promise<void> => {
  await execute('UPDATE projects SET is_active = 0');
};

export const activateProjectById = async (id: string): Promise<void> => {
  await execute(
    `UPDATE projects
     SET is_active = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
};

export const getProjectFiles = async (projectId: string): Promise<DbRow[]> => {
  return queryAll(
    'SELECT relative_path, file_type, size_bytes, modified_at FROM file_index WHERE project_id = ? ORDER BY relative_path ASC',
    [projectId]
  );
};
