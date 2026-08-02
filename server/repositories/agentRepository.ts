import { queryAll, queryOne, execute, type DbRow } from './db';
import { createId } from '../core/utils';
import type { AgentRow } from '../core/types';

export interface NewAgent {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model?: string;
  isBuiltin?: boolean;
}

const builtinAgents: NewAgent[] = [
  {
    name: 'Gestor de Proyecto Lead',
    role: 'Project Manager',
    description: 'Coordina el flujo de trabajo y descompone objetivos en tareas ejecutables',
    systemPrompt: `Project Manager Senior. Desglosa tareas y estructura la ejecución del proyecto.

Puedes crear archivos de planificación y documentación usando bloques <action>:
<action>
{"action": "write_file", "path": "docs/plan.md", "content": "contenido del plan"}
</action>`,
    isBuiltin: true,
  },
  {
    name: 'Desarrollador Backend',
    role: 'Backend Developer',
    description: 'Especialista en arquitectura de servicios, APIs y lógica de negocio',
    systemPrompt: `Backend Senior en Python/TypeScript. Escribe arquitectura y código de servicios.

Puedes crear y modificar archivos del proyecto usando bloques <action>:
<action>
{"action": "write_file", "path": "src/services/mi-servicio.ts", "content": "// código del servicio"}
</action>`,
    isBuiltin: true,
  },
  {
    name: 'Desarrollador Frontend',
    role: 'Frontend Developer',
    description: 'Experto en interfaces de usuario, componentes React y experiencia visual',
    systemPrompt: `Frontend Lead en React, TS y Tailwind. Diseña interfaces avanzadas.

Puedes crear y modificar archivos del proyecto usando bloques <action>:
<action>
{"action": "write_file", "path": "src/components/MiComponente.tsx", "content": "// código del componente"}
</action>`,
    isBuiltin: true,
  },
  {
    name: 'DBA (SQL/NoSQL)',
    role: 'Database Administrator',
    description: 'Diseña y optimiza bases de datos, esquemas y consultas',
    systemPrompt: `DBA Experto. Diseña esquemas, relaciones e índices eficientes.

Puedes crear archivos de esquemas y migraciones usando bloques <action>.
<action>
{"action": "write_file", "path": "server/schema.sql", "content": "-- esquema"}
</action>`,
    isBuiltin: true,
  },
  {
    name: 'QA Tester',
    role: 'Quality Assurance',
    description: 'Garantiza la calidad mediante pruebas automatizadas y manuales',
    systemPrompt: `Tester QA. Genera estrategias de testing, casos de borde y suite de pruebas.

Puedes crear archivos de tests usando bloques <action>.
<action>
{"action": "write_file", "path": "tests/test.js", "content": "// tests"}
</action>`,
    isBuiltin: true,
  },
  {
    name: 'DevOps Engineer',
    role: 'DevOps',
    description: 'Automatiza despliegues, infraestructura y pipelines de integración',
    systemPrompt: `Eng DevOps. Diseña Dockerfiles, pipelines CI/CD y configuraciones de despliegue.

Puedes crear archivos de configuración usando bloques <action>.
<action>
{"action": "write_file", "path": "Dockerfile", "content": "# Dockerfile"}
</action>`,
    isBuiltin: true,
  },
];

export const BUILTIN_AGENT_IDS: Record<string, string> = {
  'Gestor de Proyecto Lead': 'agent_pm_lead',
  'Desarrollador Backend': 'agent_backend_senior',
  'Desarrollador Frontend': 'agent_frontend_lead',
  'DBA (SQL/NoSQL)': 'agent_dba_expert',
  'QA Tester': 'agent_qa_tester',
  'DevOps Engineer': 'agent_devops_engineer',
};

const getNextAgentVersion = async (agentId: string): Promise<number> => {
  const row = await queryOne(
    'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM agent_versions WHERE agent_id = ?',
    [agentId]
  );
  return Number((row as unknown as { next: number } | null)?.next ?? 1);
};

export const snapshotAgentVersion = async (
  agentId: string,
  data: { name: string; role: string; description: string; systemPrompt: string }
): Promise<void> => {
  const next = await getNextAgentVersion(agentId);
  await execute(
    `INSERT INTO agent_versions (id, agent_id, version, name, role, description, system_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [createId('av'), agentId, next, data.name, data.role, data.description, data.systemPrompt]
  );
};

export const listAgentVersions = async (agentId: string): Promise<DbRow[]> => {
  return queryAll('SELECT * FROM agent_versions WHERE agent_id = ? ORDER BY version DESC LIMIT 20', [agentId]);
};

export const seedBuiltinAgents = async (): Promise<void> => {
  for (const agent of builtinAgents) {
    const id = BUILTIN_AGENT_IDS[agent.name] ?? createId('agent');
    await execute(
      `INSERT INTO agents (id, name, role, description, system_prompt, model, is_builtin, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         description = excluded.description,
         system_prompt = excluded.system_prompt,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [id, agent.name, agent.role, agent.description, agent.systemPrompt, agent.model ?? '']
    );
  }
};

export const listActiveAgents = async (): Promise<AgentRow[]> => {
  return (await queryAll(
    'SELECT * FROM agents WHERE is_active = 1 ORDER BY is_builtin DESC, created_at ASC'
  )) as unknown as AgentRow[];
};

export const listAllAgents = async (): Promise<AgentRow[]> => {
  return (await queryAll(
    'SELECT * FROM agents ORDER BY is_active DESC, is_builtin DESC, created_at ASC'
  )) as unknown as AgentRow[];
};

export const getAgentById = async (id: string): Promise<AgentRow | null> => {
  return (await queryOne('SELECT * FROM agents WHERE id = ? LIMIT 1', [id])) as unknown as AgentRow | null;
};

export const insertAgent = async (agent: NewAgent): Promise<string> => {
  const id = createId('agent');
  await execute(
    `INSERT INTO agents (id, name, role, description, system_prompt, model, is_builtin, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [
      id,
      agent.name,
      agent.role,
      agent.description,
      agent.systemPrompt,
      agent.model ?? '',
      agent.isBuiltin ? 1 : 0,
    ]
  );
  await snapshotAgentVersion(id, agent);
  return id;
};

export const updateAgent = async (
  id: string,
  data: { name: string; role: string; description: string; systemPrompt: string; model?: string }
): Promise<void> => {
  const existing = await getAgentById(id);
  if (existing && existing.system_prompt !== data.systemPrompt) {
    await snapshotAgentVersion(id, {
      name: existing.name,
      role: existing.role,
      description: existing.description,
      systemPrompt: existing.system_prompt,
    });
  }
  await execute(
    `UPDATE agents
     SET name = ?, role = ?, description = ?, system_prompt = ?, model = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.name, data.role, data.description, data.systemPrompt, data.model ?? '', id]
  );
};

export const deactivateAgent = async (id: string): Promise<void> => {
  await execute(
    `UPDATE agents
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
};

export const setAgentActive = async (id: string, active: boolean): Promise<void> => {
  await execute(
    `UPDATE agents
     SET is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [active ? 1 : 0, id]
  );
};

export interface AgentImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; name: string; error: string }>;
  total: number;
}

/** Normaliza un item crudo del JSON de import de agentes y valida sus headers. */
export const normalizeAgentItem = (
  raw: unknown,
  index: number
): { agent?: NewAgent; error?: string } => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: `[${index}] debe ser un objeto JSON` };
  }
  const obj = raw as Record<string, unknown>;
  const name = String(obj.name ?? obj.Name ?? '').trim();
  const role = String(obj.role ?? obj.Role ?? '').trim();
  const systemPrompt = String(obj.systemPrompt ?? obj.system_prompt ?? obj.SystemPrompt ?? '').trim();

  if (!name) {
    return { error: `[${index}] falta el header obligatorio "name"` };
  }
  if (!role) {
    return { error: `[${index}] falta el header obligatorio "role"` };
  }
  if (!systemPrompt) {
    return { error: `[${index}] falta el header obligatorio "systemPrompt"` };
  }

  const model = obj.model ? String(obj.model) : undefined;
  return {
    agent: {
      name,
      role,
      description: obj.description ? String(obj.description) : '',
      systemPrompt,
      model,
      isBuiltin: false,
    },
  };
};

/** Importa una lista de agentes (JSON array). El modelo queda vacío por defecto → usa el modelo global preseleccionado. */
export const importAgents = async (items: unknown[]): Promise<AgentImportResult> => {
  const result: AgentImportResult = { imported: 0, updated: 0, skipped: 0, errors: [], total: items.length };
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const { agent, error } = normalizeAgentItem(items[i], i);
    if (error || !agent) {
      result.errors.push({ index: i, name: '', error: error ?? 'item inválido' });
      continue;
    }
    if (seen.has(agent.name.toLowerCase())) {
      result.skipped++;
      continue;
    }
    seen.add(agent.name.toLowerCase());

    const existing = await queryOne('SELECT id FROM agents WHERE name = ? LIMIT 1', [agent.name]);
    if (existing) {
      await updateAgent(String(existing.id), agent);
      result.updated++;
    } else {
      await insertAgent(agent);
      result.imported++;
    }
  }
  return result;
};
