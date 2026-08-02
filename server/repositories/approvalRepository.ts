import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';

export interface NewApprovalRequest {
  projectId: string | null;
  scopeType: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
}

export const insertApprovalRequest = async (data: NewApprovalRequest): Promise<string> => {
  const id = createId('appr');
  await execute(
    `INSERT INTO approval_requests (id, project_id, scope_type, title, description, details_json, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [id, data.projectId, data.scopeType, data.title, data.description, JSON.stringify(data.details)]
  );
  return id;
};

export const listApprovalRequests = async (status?: string, limit = 50): Promise<DbRow[]> => {
  return status
    ? queryAll(
        'SELECT * FROM approval_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        [status, limit]
      )
    : queryAll('SELECT * FROM approval_requests ORDER BY created_at DESC LIMIT ?', [limit]);
};

export const getApprovalRequestById = async (id: string): Promise<DbRow | null> => {
  return queryOne('SELECT * FROM approval_requests WHERE id = ? LIMIT 1', [id]);
};

export const resolveApprovalRequest = async (
  id: string,
  status: 'approved' | 'rejected',
  decision: string,
  selectedAlternative?: number,
  feedback?: string
): Promise<void> => {
  await execute(
    `UPDATE approval_requests
     SET status = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, id]
  );
  await execute(
    `INSERT INTO approval_decisions (id, request_id, decision, selected_alternative, feedback)
     VALUES (?, ?, ?, ?, ?)`,
    [createId('appd'), id, decision, selectedAlternative ?? null, feedback ?? '']
  );
};
