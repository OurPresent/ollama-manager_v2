import { queryAll, execute } from './db';
import type { ProjectQueryRow } from '../core/types';

export const listQueries = async (projectName: string): Promise<ProjectQueryRow[]> => {
  return (await queryAll(
    'SELECT * FROM project_queries WHERE project_name = ? ORDER BY created_at DESC',
    [projectName]
  )) as unknown as ProjectQueryRow[];
};

export const insertQuery = async (query: {
  project_name: string;
  title: string;
  raw_query: string;
  optimized_query?: string | null;
  execution_time_ms?: number | null;
}): Promise<number> => {
  const result = await execute(
    `INSERT INTO project_queries (project_name, title, raw_query, optimized_query, execution_time_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [query.project_name, query.title, query.raw_query, query.optimized_query ?? null, query.execution_time_ms ?? null]
  );
  return Number(result.lastInsertRowid ?? 0);
};
