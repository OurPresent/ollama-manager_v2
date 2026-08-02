import { execute } from './db';
import { createId } from '../core/utils';

export const writeFileAccessLog = async (data: {
  projectId: string;
  relativePath: string;
  source: string;
  details?: Record<string, unknown>;
}): Promise<void> => {
  await execute(
    `INSERT INTO file_access_log (id, project_id, relative_path, source, details_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      createId('flog'),
      data.projectId,
      data.relativePath,
      data.source,
      JSON.stringify(data.details ?? {}),
    ]
  );
};
