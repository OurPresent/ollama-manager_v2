import { queryAll, execute, type DbRow } from './db';
import { createId } from '../core/utils';

export interface ChatActionInput {
  messageId: string;
  actionName: string;
  targetPath?: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  result?: Record<string, unknown>;
}

export const insertChatAction = async (input: ChatActionInput): Promise<string> => {
  const id = createId('actn');
  await execute(
    `INSERT INTO chat_actions (id, message_id, action_name, target_path, payload_json, status, result_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.messageId,
      input.actionName,
      input.targetPath ?? '',
      JSON.stringify(input.payload ?? {}),
      input.status,
      JSON.stringify(input.result ?? {}),
    ]
  );
  return id;
};

export const listChatActionsByMessage = async (messageId: string): Promise<DbRow[]> => {
  return (
    (await queryAll<DbRow>(
      `SELECT * FROM chat_actions WHERE message_id = ? ORDER BY created_at ASC`,
      [messageId]
    )) ?? []
  );
};
