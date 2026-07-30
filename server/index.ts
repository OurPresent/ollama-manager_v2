import express, { Request, Response } from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb, saveDb, initDb } from './db';

const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().then(() => {
const PORT = 8502;
app.listen(PORT, () => {
  console.log(`🚀 Server backend SQLite corriendo en http://localhost:${PORT}`);
});
}).catch(console.error);

// Helper function to get database instance
const getDbInstance = async () => getDb();

// ------------------------------------------------------------------
// 1. ENDPOINTS DEL GRAFO DE MEMORIA
// ------------------------------------------------------------------
app.get('/api/graph/:project', async (req: Request, res: Response) => {
  try {
    const { project } = req.params;
    const db = await getDbInstance();
    const stmt = db.prepare('SELECT * FROM graph_nodes WHERE project_name = ? ORDER BY updated_at DESC');
    const nodes = stmt.all(project);
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
    stmt.run(id, project_name, node_type, title, content);
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
    const db = await getDbInstance();
    const stmt = db.prepare('SELECT * FROM project_queries WHERE project_name = ? ORDER BY created_at DESC');
    res.json(stmt.all(project));
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
    const result = stmt.run(project_name, title, raw_query, optimized_query, execution_time_ms);
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
    const db = await getDbInstance();
    const stmt = db.prepare('SELECT * FROM task_logs WHERE project_name = ? ORDER BY created_at DESC');
    const logs = stmt.all(project).map((log: any) => ({
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
    stmt.run(task_id, project_name, title, markdown_content, JSON.stringify(tags || []));
    saveDb();
    res.json({ status: 'ok', task_id });
  } catch (error) {
    console.error('Error saving log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// 4. ENDPOINTS DE CONTROL DE DOCKER (OLLAMA)
// ------------------------------------------------------------------
app.get('/api/docker/ollama/status', async (req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=ollama" --format "{{.Names}}\t{{.Status}}"');
    const isRunning = stdout.includes('ollama');
    res.json({ running: isRunning, details: stdout || 'No running' });
  } catch (error) {
    res.json({ running: false, details: 'Docker not available or ollama container not found' });
  }
});

app.post('/api/docker/ollama/start', async (req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('docker start ollama');
    res.json({ status: 'ok', message: 'Ollama started', output: stdout });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start ollama', details: error.message });
  }
});

app.post('/api/docker/ollama/stop', async (req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('docker stop ollama');
    res.json({ status: 'ok', message: 'Ollama stopped', output: stdout });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to stop ollama', details: error.message });
  }
});
