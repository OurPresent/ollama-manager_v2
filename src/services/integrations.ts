export interface IntegrationCheck {
  type: 'cli' | 'npm' | 'docker';
  name: string;
}

export interface IntegrationEnvVar {
  key: string;
  hint: string;
  required: boolean;
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  docsUrl: string;
  usesLocalhost: boolean;
  checks: IntegrationCheck[];
  setupGuide: string[];
  envVars: IntegrationEnvVar[];
  detected: boolean;
  detectedVia: string[];
  installedNpm: boolean;
}

export interface IntegrationsCatalog {
  integrations: Integration[];
  summary: { total: number; detected: number; categories: string[] };
}

const API_BASE = '/api/integrations';

export const fetchIntegrations = async (): Promise<IntegrationsCatalog> => {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('No se pudieron cargar las integraciones');
  return (await res.json()) as IntegrationsCatalog;
};

export const fetchIntegration = async (id: string): Promise<Integration> => {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error('No se pudo cargar la integración');
  return (await res.json()) as Integration;
};

export const fetchIntegrationGuide = async (id: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/${id}/guide`);
  if (!res.ok) throw new Error('No se pudo generar la guía');
  return await res.text();
};

export const redetectIntegration = async (id: string): Promise<Integration> => {
  const res = await fetch(`${API_BASE}/${id}/detect`, { method: 'POST' });
  if (!res.ok) throw new Error('No se pudo re-detectar la integración');
  return (await res.json()) as Integration;
};
