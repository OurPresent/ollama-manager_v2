import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import { getDb, saveDb, initDb } from './db';

const app = express();
app.use(cors());
app.use(express.json());

const builtinAgents = [
  {
    id: 'agent_pm_lead',
    name: 'Gestor de Proyecto Lead',
    role: 'Project Manager',
    description: 'Coordina el flujo de trabajo y descompone objetivos en tareas ejecutables',
    systemPrompt: 'Project Manager Senior. Desglosa tareas y estructura la ejecución.',
  },
  {
    id: 'agent_backend_senior',
    name: 'Desarrollador Backend',
    role: 'Backend Developer',
    description: 'Especialista en arquitectura de servicios, APIs y lógica de negocio',
    systemPrompt: 'Backend Senior en Python/TypeScript. Escribe arquitectura y código de servicios.',
  },
  {
    id: 'agent_frontend_lead',
    name: 'Desarrollador Frontend',
    role: 'Frontend Developer',
    description: 'Experto en interfaces de usuario, componentes React y experiencia visual',
    systemPrompt: 'Frontend Lead en React, TS y Tailwind. Diseña interfaces avanzadas.',
  },
  {
    id: 'agent_dba_expert',
    name: 'DBA (SQL/NoSQL)',
    role: 'Database Administrator',
    description: 'Diseña y optimiza bases de datos, esquemas y consultas',
    systemPrompt: 'DBA Experto. Diseña esquemas, relaciones e índices eficientes.',
  },
  {
    id: 'agent_qa_tester',
    name: 'QA Tester',
    role: 'Quality Assurance',
    description: 'Garantiza la calidad mediante pruebas automatizadas y manuales',
    systemPrompt: 'Tester QA. Genera estrategias de testing, casos de borde y suite de pruebas.',
  },
  {
    id: 'agent_devops_engineer',
    name: 'DevOps Engineer',
    role: 'DevOps',
    description: 'Automatiza despliegues, infraestructura y pipelines de integración',
    systemPrompt: 'Eng DevOps. Diseña Dockerfiles, pipelines CI/CD y configuraciones de despliegue.',
  }
];

const createId = (prefix: string) => `${prefix}_${randomUUID()}`;

const writeSystemLog = async (
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  details: Record<string, unknown> = {}
) => {
  const db = await getDbInstance();
  const stmt = db.prepare(`
    INSERT INTO system_logs (id, level, source, message, details_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run([createId('log'), level, source, message, JSON.stringify(details)]);
  saveDb();
};

const writeAuditEvent = async (
  eventType: string,
  entityType: string,
  entityId: string,
  projectId: string | null,
  details: Record<string, unknown> = {}
) => {
  const db = await getDbInstance();
  const stmt = db.prepare(`
    INSERT INTO audit_events (id, event_type, entity_type, entity_id, project_id, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([createId('audit'), eventType, entityType, entityId, projectId, JSON.stringify(details)]);
  saveDb();
};

const seedBuiltinAgents = async () => {
  const db = await getDbInstance();
  const stmt = db.prepare(`
    INSERT INTO agents (id, name, role, description, system_prompt, is_builtin, is_active)
    VALUES (?, ?, ?, ?, ?, 1, 1)
    ON CONFLICT(id) DO NOTHING
  `);

  for (const agent of builtinAgents) {
    stmt.run([agent.id, agent.name, agent.role, agent.description, agent.systemPrompt]);
  }
  saveDb();
};

// Initialize database on startup
initDb().then(() => {
  seedBuiltinAgents()
    .then(async () => {
      await writeSystemLog('info', 'server', 'Backend inicializado correctamente');
      const PORT = 8502;
      app.listen(PORT, () => {
        console.log(`🚀 Server backend SQLite corriendo en http://localhost:${PORT}`);
      });
    })
    .catch(console.error);
}).catch(console.error);

// Helper function to get database instance
const getDbInstance = async () => getDb();

const queryAllRows = async (sql: string, params: any[] = []) => {
  const db = await getDbInstance();
  const stmt = db.prepare(sql) as any;
  stmt.bind(params);

  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }

  stmt.free();
  return rows;
};

const queryOneRow = async (sql: string, params: any[] = []) => {
  const rows = await queryAllRows(sql, params);
  return rows[0] || null;
};

// ------------------------------------------------------------------
// 0. ENDPOINTS NUCLEARES DEL SISTEMA
// ------------------------------------------------------------------
app.get('/api/settings/app', async (_req: Request, res: Response) => {
  try {
    const rows = await queryAllRows('SELECT key, value, updated_at FROM app_settings ORDER BY key ASC') as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;

    const settings = rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    res.json({
      theme: settings.theme || 'dark',
      ollamaUrl: settings.ollama_url || 'http://localhost:11434',
      ollamaMode: settings.ollama_mode || 'local',
      raw: rows,
    });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/settings/app', async (req: Request, res: Response) => {
  try {
    const { theme, ollamaUrl, ollamaMode } = req.body;
    const db = await getDbInstance();
    const upsertStmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    const updates = [
      ['theme', theme || 'dark'],
      ['ollama_url', ollamaUrl || 'http://localhost:11434'],
      ['ollama_mode', ollamaMode || 'local'],
    ];

    for (const [key, value] of updates) {
      upsertStmt.run([key, value]);
    }
    saveDb();
    await writeAuditEvent('settings.updated', 'app_settings', 'global', null, {
      theme: theme || 'dark',
      ollamaUrl: ollamaUrl || 'http://localhost:11434',
      ollamaMode: ollamaMode || 'local',
    });

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error saving app settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/projects', async (_req: Request, res: Response) => {
  try {
    const rows = await queryAllRows('SELECT * FROM projects ORDER BY is_active DESC, updated_at DESC, name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/projects/active', async (_req: Request, res: Response) => {
  try {
    const activeProject = await queryOneRow('SELECT * FROM projects WHERE is_active = 1 LIMIT 1');
    res.json(activeProject || null);
  } catch (error) {
    console.error('Error fetching active project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/projects/register', async (req: Request, res: Response) => {
  try {
    const { name, rootPath, description } = req.body;

    if (!name || !rootPath) {
      res.status(400).json({ error: 'name and rootPath are required' });
      return;
    }

    const normalizedRootPath = path.resolve(rootPath);
    if (!fs.existsSync(normalizedRootPath)) {
      res.status(400).json({ error: 'The provided project path does not exist' });
      return;
    }

    const stat = fs.statSync(normalizedRootPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'The provided project path is not a directory' });
      return;
    }

    const db = await getDbInstance();
    const existing = await queryOneRow('SELECT * FROM projects WHERE root_path = ? LIMIT 1', [normalizedRootPath]) as Record<string, any> | null;

    if (existing) {
      const updateStmt = db.prepare(`
        UPDATE projects
        SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run([name, description || '', existing.id]);
      saveDb();
      await writeAuditEvent('project.updated', 'project', existing.id, existing.id, {
        rootPath: normalizedRootPath,
      });
      res.json({ status: 'ok', project: { ...existing, name, description: description || '' } });
      return;
    }

    const projectId = createId('project');
    const insertStmt = db.prepare(`
      INSERT INTO projects (id, name, root_path, description, is_active, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
    insertStmt.run([projectId, name, normalizedRootPath, description || '']);
    saveDb();
    await writeAuditEvent('project.created', 'project', projectId, projectId, {
      rootPath: normalizedRootPath,
    });

    res.json({
      status: 'ok',
      project: {
        id: projectId,
        name,
        root_path: normalizedRootPath,
        description: description || '',
        is_active: 0,
      }
    });
  } catch (error) {
    console.error('Error registering project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/projects/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDbInstance();
    const project = await queryOneRow('SELECT * FROM projects WHERE id = ? LIMIT 1', [id]) as Record<string, any> | null;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    db.exec('UPDATE projects SET is_active = 0');
    const activateStmt = db.prepare(`
      UPDATE projects
      SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    activateStmt.run([id]);
    saveDb();
    await writeAuditEvent('project.activated', 'project', id, id);
    res.json({ status: 'ok', project: { ...project, is_active: 1 } });
  } catch (error) {
    console.error('Error activating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/agents', async (_req: Request, res: Response) => {
  try {
    const rows = await queryAllRows('SELECT * FROM agents WHERE is_active = 1 ORDER BY is_builtin DESC, created_at ASC') as Array<any>;
    const agents = rows.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      systemPrompt: agent.system_prompt,
      isBuiltin: Boolean(agent.is_builtin),
      status: 'idle',
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
    }));
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/agents', async (req: Request, res: Response) => {
  try {
    const { name, role, description, systemPrompt } = req.body;
    if (!name || !role || !systemPrompt) {
      res.status(400).json({ error: 'name, role and systemPrompt are required' });
      return;
    }

    const id = createId('agent');
    const db = await getDbInstance();
    const stmt = db.prepare(`
      INSERT INTO agents (id, name, role, description, system_prompt, is_builtin, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP)
    `);
    stmt.run([id, name, role, description || '', systemPrompt]);
    saveDb();
    await writeAuditEvent('agent.created', 'agent', id, null, { name, role });
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/agents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, description, systemPrompt } = req.body;
    if (!name || !role || !systemPrompt) {
      res.status(400).json({ error: 'name, role and systemPrompt are required' });
      return;
    }

    const db = await getDbInstance();
    const stmt = db.prepare(`
      UPDATE agents
      SET name = ?, role = ?, description = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run([name, role, description || '', systemPrompt, id]);
    saveDb();
    await writeAuditEvent('agent.updated', 'agent', id, null, { name, role });
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/agents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDbInstance();
    const stmt = db.prepare(`
      UPDATE agents
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run([id]);
    saveDb();
    await writeAuditEvent('agent.deactivated', 'agent', id, null);
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// 1. ENDPOINTS DEL GRAFO DE MEMORIA
// ------------------------------------------------------------------
app.get('/api/graph/:project', async (req: Request, res: Response) => {
  try {
    const { project } = req.params;
    const nodes = await queryAllRows('SELECT * FROM graph_nodes WHERE project_name = ? ORDER BY updated_at DESC', [project]);
    res.json(nodes);
  } catch (error) {
    console.error('Error fetching graph nodes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/graph', async (req: Request, res: Response) => {
  try {
    const { id, project_name, node_type, title, content } = req.body;
    const db = await getDbInstance();
    const stmt = db.prepare(`
      INSERT INTO graph_nodes (id, project_name, node_type, title, content, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        node_type = excluded.node_type,
        title = excluded.title,
        content = excluded.content,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run([id, project_name, node_type, title, content]);
    saveDb();
    res.json({ status: 'ok', id });
  } catch (error) {
    console.error('Error saving graph node:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// 2. ENDPOINTS DE CONSULTAS SQL / OPTIMIZACIONES
// ------------------------------------------------------------------
app.get('/api/queries/:project', async (req: Request, res: Response) => {
  try {
    const { project } = req.params;
    const rows = await queryAllRows('SELECT * FROM project_queries WHERE project_name = ? ORDER BY created_at DESC', [project]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/queries', async (req: Request, res: Response) => {
  try {
    const { project_name, title, raw_query, optimized_query, execution_time_ms } = req.body;
    const db = await getDbInstance();
    const stmt = db.prepare(`
      INSERT INTO project_queries (project_name, title, raw_query, optimized_query, execution_time_ms)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run([project_name, title, raw_query, optimized_query, execution_time_ms]);
    saveDb();
    res.json({ status: 'ok', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error saving query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// 3. ENDPOINTS DE BITÁCORAS MARKDOWN (.md)
// ------------------------------------------------------------------
app.get('/api/logs/:project', async (req: Request, res: Response) => {
  try {
    const { project } = req.params;
    const logs = (await queryAllRows('SELECT * FROM task_logs WHERE project_name = ? ORDER BY created_at DESC', [project])).map((log: any) => ({
      ...log,
      tags: JSON.parse(log.tags || '[]')
    }));
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logs', async (req: Request, res: Response) => {
  try {
    const { task_id, project_name, title, markdown_content, tags } = req.body;
    const db = await getDbInstance();
    const stmt = db.prepare(`
      INSERT INTO task_logs (task_id, project_name, title, markdown_content, tags)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        title = excluded.title,
        markdown_content = excluded.markdown_content,
        tags = excluded.tags
    `);
    stmt.run([task_id, project_name, title, markdown_content, JSON.stringify(tags || [])]);
    saveDb();
    res.json({ status: 'ok', task_id });
  } catch (error) {
    console.error('Error saving log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// 5. ENDPOINTS DE ACCIONES DEL SISTEMA (PYTHON)
// ------------------------------------------------------------------
app.post('/api/actions/execute', async (req: Request, res: Response) => {
  try {
    const { action, project_path, path: filePath, content } = req.body;

    if (!action || !project_path) {
      res.status(400).json({ success: false, error: 'action and project_path are required' });
      return;
    }

    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action, project_path, path: filePath, content });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    pythonProcess.on('error', (error: Error) => {
      console.error('Python action error:', error.message);
      res.status(500).json({ success: false, error: `Python error: ${error.message}`, stderr });
    });

    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        console.error('Python process exited with code:', code);
        res.status(500).json({ success: false, error: `Python process exited with code ${code}`, stderr });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        res.json(result);
      } catch (e) {
        console.error('Failed to parse Python output:', stdout);
        res.status(500).json({ success: false, error: 'Failed to parse Python output', stdout });
      }
    });

    // Send input data via stdin
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------------------------------------------------------------
// 4. ENDPOINTS DE CONTROL DE DOCKER (OLLAMA) - VIA PYTHON
// ------------------------------------------------------------------
app.get('/api/docker/ollama/status', async (_req: Request, res: Response) => {
  try {
    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action: 'docker_check_ollama' });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    pythonProcess.on('error', (error: Error) => {
      res.json({ running: false, details: `Error: ${error.message}` });
    });

    pythonProcess.on('close', (_code: number | null) => {
      try {
        const result = JSON.parse(stdout.trim());
        res.json({
          running: result.running || false,
          details: result.details || 'No info',
          mode: result.mode || 'unknown'
        });
      } catch (e) {
        res.json({ running: false, details: 'Failed to check Ollama status' });
      }
    });

    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.json({ running: false, details: error.message });
  }
});

app.post('/api/docker/ollama/start', async (_req: Request, res: Response) => {
  try {
    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action: 'docker_start_ollama' });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    pythonProcess.on('error', (error: Error) => {
      res.status(500).json({ error: 'Failed to start Ollama', details: error.message });
    });

    pythonProcess.on('close', (_code: number | null) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          res.json({ status: 'ok', message: result.result, output: result.output || '' });
        } else {
          res.status(500).json({ error: result.error || 'Failed to start Ollama' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Python output' });
      }
    });

    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start ollama', details: error.message });
  }
});

app.post('/api/docker/ollama/stop', async (_req: Request, res: Response) => {
  try {
    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action: 'docker_stop_ollama' });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    pythonProcess.on('error', (error: Error) => {
      res.status(500).json({ error: 'Failed to stop Ollama', details: error.message });
    });

    pythonProcess.on('close', (_code: number | null) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          res.json({ status: 'ok', message: result.result, output: result.output || '' });
        } else {
          res.status(500).json({ error: result.error || 'Failed to stop Ollama' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Python output' });
      }
    });

    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to stop ollama', details: error.message });
  }
});

app.post('/api/docker/ollama/restart', async (_req: Request, res: Response) => {
  try {
    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action: 'docker_restart_ollama' });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    pythonProcess.on('error', (error: Error) => {
      res.status(500).json({ error: 'Failed to restart Ollama', details: error.message });
    });

    pythonProcess.on('close', (_code: number | null) => {
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          res.json({ status: 'ok', message: result.result, output: result.output || '' });
        } else {
          res.status(500).json({ error: result.error || 'Failed to restart Ollama' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Python output' });
      }
    });

    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to restart ollama', details: error.message });
  }
});

app.get('/api/docker/info', async (_req: Request, res: Response) => {
  try {
    const pythonScript = path.join(__dirname, 'actions.py');
    const inputData = JSON.stringify({ action: 'docker_get_info' });

    const pythonProcess = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    pythonProcess.on('error', (error: Error) => {
      res.status(500).json({ error: error.message });
    });

    pythonProcess.on('close', (_code: number | null) => {
      try {
        const result = JSON.parse(stdout.trim());
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Python output' });
      }
    });

    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
