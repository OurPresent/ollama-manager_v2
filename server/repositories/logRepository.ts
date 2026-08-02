import { queryAll, execute } from './db';
import type { TaskLogRow } from '../core/types';

export const listTaskLogs = async (projectName: string): Promise<TaskLogRow[]> => {
  return (await queryAll(
    'SELECT * FROM task_logs WHERE project_name = ? ORDER BY created_at DESC',
    [projectName]
  )) as unknown as TaskLogRow[];
};

export const upsertTaskLog = async (log: {
  task_id: string;
  project_name: string;
  title: string;
  markdown_content: string;
  tags: string[];
}): Promise<void> => {
  await execute(
    `INSERT INTO task_logs (task_id, project_name, title, markdown_content, tags)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET
       title = excluded.title,
       markdown_content = excluded.markdown_content,
       tags = excluded.tags`,
    [log.task_id, log.project_name, log.title, log.markdown_content, JSON.stringify(log.tags)]
  );
};
