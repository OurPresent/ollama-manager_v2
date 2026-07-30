import express, { Request, Response } from 'express';
import cors from 'cors';
import { getDb, saveDb, initDb } from './db';

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
// 5. ENDPOINTS DE ACCIONES DEL SISTEMA (PYTHON)
// ------------------------------------------------------------------
import { spawn } from 'child_process';
import path from 'path';

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

