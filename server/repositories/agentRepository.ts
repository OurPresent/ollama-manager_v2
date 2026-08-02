import { queryAll, queryOne, execute } from './db';
import { createId } from '../core/utils';
import type { AgentRow } from '../core/types';

export interface NewAgent {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
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

export const seedBuiltinAgents = async (): Promise<void> => {
  for (const agent of builtinAgents) {
    const id = BUILTIN_AGENT_IDS[agent.name] ?? createId('agent');
    await execute(
      `INSERT INTO agents (id, name, role, description, system_prompt, is_builtin, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         description = excluded.description,
         system_prompt = excluded.system_prompt,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [id, agent.name, agent.role, agent.description, agent.systemPrompt]
    );
  }
};

export const listActiveAgents = async (): Promise<AgentRow[]> => {
  return (await queryAll(
    'SELECT * FROM agents WHERE is_active = 1 ORDER BY is_builtin DESC, created_at ASC'
  )) as unknown as AgentRow[];
};

export const getAgentById = async (id: string): Promise<AgentRow | null> => {
  return (await queryOne('SELECT * FROM agents WHERE id = ? LIMIT 1', [id])) as unknown as AgentRow | null;
};

export const insertAgent = async (agent: NewAgent): Promise<string> => {
  const id = createId('agent');
  await execute(
    `INSERT INTO agents (id, name, role, description, system_prompt, is_builtin, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [id, agent.name, agent.role, agent.description, agent.systemPrompt, agent.isBuiltin ? 1 : 0]
  );
  return id;
};

export const updateAgent = async (
  id: string,
  data: { name: string; role: string; description: string; systemPrompt: string }
): Promise<void> => {
  await execute(
    `UPDATE agents
     SET name = ?, role = ?, description = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.name, data.role, data.description, data.systemPrompt, id]
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
