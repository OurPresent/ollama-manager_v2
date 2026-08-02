import { queryAll } from '../repositories/db';

export interface ModelUsage {
  model: string;
  sessions: number;
  messages: number;
  agentRuns: number;
}

export const getModelUsage = async (): Promise<ModelUsage[]> => {
  const [sessions, messages, runs] = await Promise.all([
    queryAll<{ model: string; sessions: number }>(
      `SELECT model_name AS model, COUNT(*) AS sessions
       FROM chat_sessions
       WHERE model_name IS NOT NULL AND model_name != ''
       GROUP BY model_name`
    ),
    queryAll<{ model: string; messages: number }>(
      `SELECT cs.model_name AS model, COUNT(*) AS messages
       FROM chat_messages cm
       JOIN chat_sessions cs ON cs.id = cm.session_id
       WHERE cs.model_name IS NOT NULL AND cs.model_name != ''
       GROUP BY cs.model_name`
    ),
    queryAll<{ model: string; agent_runs: number }>(
      `SELECT model_name AS model, COUNT(*) AS agent_runs
       FROM agent_runs
       WHERE model_name IS NOT NULL AND model_name != ''
       GROUP BY model_name`
    ),
  ]);

  const byModel = new Map<string, ModelUsage>();
  const seed = (model: string): ModelUsage => ({ model, sessions: 0, messages: 0, agentRuns: 0 });

  for (const row of sessions) {
    const entry = byModel.get(row.model) ?? seed(row.model);
    entry.sessions = Number(row.sessions);
    byModel.set(row.model, entry);
  }
  for (const row of messages) {
    const entry = byModel.get(row.model) ?? seed(row.model);
    entry.messages = Number(row.messages);
    byModel.set(row.model, entry);
  }
  for (const row of runs) {
    const entry = byModel.get(row.model) ?? seed(row.model);
    entry.agentRuns = Number(row.agent_runs);
    byModel.set(row.model, entry);
  }

  const list = [...byModel.values()];
  list.sort(
    (a, b) => b.sessions + b.messages + b.agentRuns - (a.sessions + a.messages + a.agentRuns)
  );
  return list;
};
