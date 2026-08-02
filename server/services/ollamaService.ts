import { pythonRunner } from './pythonRunner';
import { getAppSettings } from '../repositories/settingsRepository';

export interface OllamaContext {
  mode: 'docker' | 'local';
  ollamaUrl: string;
}

const defaultContext = (): OllamaContext => ({
  mode: 'local',
  ollamaUrl: 'http://localhost:11434',
});

export const getOllamaContext = async (): Promise<OllamaContext> => {
  try {
    const settings = await getAppSettings();
    return {
      mode: settings.ollamaMode ?? 'local',
      ollamaUrl: settings.ollamaUrl ?? 'http://localhost:11434',
    };
  } catch {
    return defaultContext();
  }
};

export const listOllamaModels = async (): Promise<unknown> => {
  const ctx = await getOllamaContext();
  return pythonRunner.run({ action: 'ollama_list_models', ollama_url: ctx.ollamaUrl }, 15000);
};

export const getRunningModels = async (): Promise<unknown> => {
  const ctx = await getOllamaContext();
  return pythonRunner.run({ action: 'ollama_running_models', ollama_url: ctx.ollamaUrl }, 15000);
};

export const loadModel = async (model: string): Promise<unknown> => {
  const ctx = await getOllamaContext();
  return pythonRunner.run({ action: 'ollama_load_model', ollama_url: ctx.ollamaUrl, model }, 180000);
};

export const stopModel = async (model: string): Promise<unknown> => {
  const ctx = await getOllamaContext();
  return pythonRunner.run({ action: 'ollama_stop_model', ollama_url: ctx.ollamaUrl, model }, 60000);
};
