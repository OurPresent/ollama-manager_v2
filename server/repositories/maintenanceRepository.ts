import { execute, queryAll, type DbRow } from './db';

const runQuery = async <T = DbRow[]>(sql: string): Promise<T> => {
  return (await queryAll(sql)) as T;
};

export interface CleanupTargets {
  chats: boolean;
  opencode: boolean;
  plans: boolean;
  taskLogs: boolean;
  queries: boolean;
  graph: boolean;
  audit: boolean;
  systemLogs: boolean;
  approvals: boolean;
}

export interface CleanupOptions {
  targets: CleanupTargets;
  olderThanDays?: number;
  projectId?: string;
}

export interface CleanupResult {
  counts: Record<string, number>;
}

const DAYS_CLAUSE = (days?: number): string =>
  days && days > 0 ? ` AND created_at < datetime('now', '-' || ${Math.floor(days)} || ' days')` : '';

const PROJECT_CLAUSE = (table: string, projectId?: string): string =>
  projectId ? ` AND ${table}.project_id = '${projectId.replace(/'/g, "''")}'` : '';

export const cleanupData = async (options: CleanupOptions): Promise<CleanupResult> => {
  const { targets, olderThanDays, projectId } = options;
  const counts: Record<string, number> = {};

  // ---- Chats (sesiones + mensajes + acciones) ----
  if (targets.chats) {
    const sessionsSql = `SELECT id FROM chat_sessions WHERE 1=1${PROJECT_CLAUSE('chat_sessions', projectId)}${DAYS_CLAUSE(olderThanDays)}`;
    const sessions = await runQuery<string[]>(sessionsSql);
    const ids = sessions.map((r) => String(r)).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    if (ids) {
      await execute(`DELETE FROM chat_actions WHERE message_id IN (SELECT id FROM chat_messages WHERE session_id IN (${ids}))`);
      counts.chatMessages = (await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM chat_messages WHERE session_id IN (${ids})`))[0]?.n ?? 0;
      await execute(`DELETE FROM chat_messages WHERE session_id IN (${ids})`);
      await execute(`DELETE FROM chat_sessions WHERE id IN (${ids})`);
    }
    counts.chatSessions = ids.split(',').filter(Boolean).length;
  }

  // ---- OpenCode (sesiones + mensajes) ----
  if (targets.opencode) {
    const sessionsSql = `SELECT id FROM opencode_sessions WHERE 1=1${PROJECT_CLAUSE('opencode_sessions', projectId)}${DAYS_CLAUSE(olderThanDays)}`;
    const sessions = await runQuery<string[]>(sessionsSql);
    const ids = sessions.map((r) => String(r)).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    if (ids) {
      await execute(`DELETE FROM opencode_messages WHERE session_id IN (${ids})`);
      await execute(`DELETE FROM opencode_sessions WHERE id IN (${ids})`);
    }
    counts.opencodeSessions = ids.split(',').filter(Boolean).length;
  }

  // ---- Planes (runs finalizados + pasos + agent_runs) ----
  if (targets.plans) {
    let runsSql = `SELECT id FROM plan_runs WHERE status IN ('completed', 'error', 'cancelled')`;
    if (projectId) runsSql += PROJECT_CLAUSE('plan_runs', projectId);
    if (olderThanDays && olderThanDays > 0) {
      runsSql += ` AND started_at < datetime('now', '-' || ${Math.floor(olderThanDays)} || ' days')`;
    }
    const runs = await runQuery<string[]>(runsSql);
    const ids = runs.map((r) => String(r)).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    if (ids) {
      await execute(`DELETE FROM plan_steps WHERE plan_run_id IN (${ids})`);
      await execute(`DELETE FROM agent_runs WHERE plan_run_id IN (${ids})`);
      await execute(`DELETE FROM plan_runs WHERE id IN (${ids})`);
    }
    counts.planRuns = ids.split(',').filter(Boolean).length;
  }

  // ---- Bitácoras .md ----
  if (targets.taskLogs) {
    let sql = `DELETE FROM task_logs WHERE 1=1`;
    if (projectId) {
      sql += ` AND project_name = (SELECT name FROM projects WHERE id = '${projectId.replace(/'/g, "''")}')`;
    }
    sql += DAYS_CLAUSE(olderThanDays);
    const before = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM task_logs`);
    await execute(sql);
    const after = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM task_logs`);
    counts.taskLogs = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
  }

  // ---- Consultas ----
  if (targets.queries) {
    let sql = `DELETE FROM project_queries WHERE 1=1`;
    if (projectId) {
      sql += ` AND project_name = (SELECT name FROM projects WHERE id = '${projectId.replace(/'/g, "''")}')`;
    }
    sql += DAYS_CLAUSE(olderThanDays);
    const before = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM project_queries`);
    await execute(sql);
    const after = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM project_queries`);
    counts.queries = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
  }

  // ---- Grafo ----
  if (targets.graph) {
    let sql = `DELETE FROM graph_nodes WHERE 1=1`;
    if (projectId) {
      sql += ` AND project_name = (SELECT name FROM projects WHERE id = '${projectId.replace(/'/g, "''")}')`;
    }
    sql += DAYS_CLAUSE(olderThanDays);
    const before = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM graph_nodes`);
    await execute(sql);
    const after = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM graph_nodes`);
    counts.graph = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
  }

  // ---- Auditoría ----
  if (targets.audit) {
    let sql = `DELETE FROM audit_events WHERE 1=1`;
    if (projectId) {
      sql += PROJECT_CLAUSE('audit_events', projectId);
    }
    sql += DAYS_CLAUSE(olderThanDays);
    const before = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM audit_events`);
    await execute(sql);
    const after = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM audit_events`);
    counts.audit = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
  }

  // ---- Logs del sistema ----
  if (targets.systemLogs) {
    const sql = `DELETE FROM system_logs WHERE 1=1${DAYS_CLAUSE(olderThanDays)}`;
    const before = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM system_logs`);
    await execute(sql);
    const after = await runQuery<{ n: number }[]>(`SELECT COUNT(*) AS n FROM system_logs`);
    counts.systemLogs = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
  }

  // ---- Aprobaciones resueltas ----
  if (targets.approvals) {
    let sql = `SELECT id FROM approval_requests WHERE status IN ('approved', 'rejected')`;
    if (projectId) {
      sql += PROJECT_CLAUSE('approval_requests', projectId);
    }
    sql += DAYS_CLAUSE(olderThanDays);
    const rows = await runQuery<string[]>(sql);
    const ids = rows.map((r) => String(r)).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    if (ids) {
      await execute(`DELETE FROM approval_decisions WHERE request_id IN (${ids})`);
      await execute(`DELETE FROM approval_requests WHERE id IN (${ids})`);
    }
    counts.approvals = ids.split(',').filter(Boolean).length;
  }

  return { counts };
};
