import { queryAll, queryOne, execute } from './db';
import type { AppSettings, AppSettingsRow } from '../core/types';

export const getSetting = async (key: string): Promise<string | null> => {
  const row = await queryOne<AppSettingsRow>(
    'SELECT key, value, updated_at FROM app_settings WHERE key = ? LIMIT 1',
    [key]
  );
  return row?.value ?? null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
};

export const deleteSetting = async (key: string): Promise<void> => {
  await execute('DELETE FROM app_settings WHERE key = ?', [key]);
};

export interface AppSettingsResult extends AppSettings {
  raw: AppSettingsRow[];
}

export const getAppSettings = async (): Promise<AppSettingsResult> => {
  const rows = (await queryAll(
    'SELECT key, value, updated_at FROM app_settings ORDER BY key ASC'
  )) as unknown as AppSettingsRow[];

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return {
    theme: map.theme === 'light' || map.theme === 'system' ? map.theme : 'dark',
    ollamaUrl: map.ollama_url || 'http://localhost:11434',
    ollamaMode: map.ollama_mode === 'docker' ? 'docker' : 'local',
    raw: rows,
  };
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
  const updates: Array<[string, string]> = [
    ['theme', settings.theme],
    ['ollama_url', settings.ollamaUrl],
    ['ollama_mode', settings.ollamaMode],
  ];

  for (const [key, value] of updates) {
    await execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }
};
