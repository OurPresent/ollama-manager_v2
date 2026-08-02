import { getDb, saveDb } from '../db';

export type DbRow = Record<string, unknown>;

export const queryAll = async <T = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
};

export const queryOne = async <T = DbRow>(sql: string, params: unknown[] = []): Promise<T | null> => {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
};

export const execute = async (
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertRowid?: number }> => {
  const db = await getDb();
  const stmt = db.prepare(sql);
  let result: { lastInsertRowid?: number } = {};
  try {
    const runResult = stmt.run(params);
    result = { lastInsertRowid: runResult?.lastInsertRowid };
  } finally {
    stmt.free();
  }
  saveDb();
  return result;
};
