import { getDb, saveDb } from '../db';
import { createId } from './utils';

export const writeSystemLog = async (
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  details: Record<string, unknown> = {}
): Promise<void> => {
  const db = await getDb();
  const stmt = db.prepare(
    `INSERT INTO system_logs (id, level, source, message, details_json)
     VALUES (?, ?, ?, ?, ?)`
  );
  stmt.run([createId('log'), level, source, message, JSON.stringify(details)]);
  saveDb();
};

export const writeAuditEvent = async (
  eventType: string,
  entityType: string,
  entityId: string,
  projectId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> => {
  const db = await getDb();
  const stmt = db.prepare(
    `INSERT INTO audit_events (id, event_type, entity_type, entity_id, project_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run([createId('audit'), eventType, entityType, entityId, projectId, JSON.stringify(details)]);
  saveDb();
};
