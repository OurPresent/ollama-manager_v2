import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import { seedBuiltinAgents } from './repositories/agentRepository';
import { writeSystemLog } from './core/audit';
import { settingsRouter } from './routes/settingsRoutes';
import { projectRouter } from './routes/projectRoutes';
import { agentRouter } from './routes/agentRoutes';
import { graphRouter } from './routes/graphRoutes';
import { queryRouter } from './routes/queryRoutes';
import { logRouter } from './routes/logRoutes';
import { actionRouter } from './routes/actionRoutes';
import { dockerRouter } from './routes/dockerRoutes';
import { ollamaRouter } from './routes/ollamaRoutes';
import { chatRouter } from './routes/chatRoutes';
import { auditRouter } from './routes/auditRoutes';
import { planRouter } from './routes/planRoutes';
import { approvalRouter } from './routes/approvalRoutes';
import { systemRouter } from './routes/systemRoutes';
import { opencodeRouter } from './routes/opencodeRoutes';
import { skillsRouter } from './routes/skillsRoutes';
import { integrationsRouter } from './routes/integrationsRoutes';
import { deviceRouter } from './routes/deviceRoutes';
import { stopManagedOpenCodeServer } from './services/opencodeServerManager';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/settings', settingsRouter);
app.use('/api/projects', projectRouter);
app.use('/api/agents', agentRouter);
app.use('/api/graph', graphRouter);
app.use('/api/queries', queryRouter);
app.use('/api/logs', logRouter);
app.use('/api/actions', actionRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/ollama', ollamaRouter);
app.use('/api/chat', chatRouter);
app.use('/api/audit', auditRouter);
app.use('/api/plans', planRouter);
app.use('/api/approvals', approvalRouter);
app.use('/api/system', systemRouter);
app.use('/api/opencode', opencodeRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/device', deviceRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ollama-manager-v2' });
});

const PORT = 8502;

const shutdown = (): void => {
  console.log('🛑 Deteniendo backend...');
  stopManagedOpenCodeServer();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

initDb()
  .then(async () => {
    await seedBuiltinAgents();
    await writeSystemLog('info', 'server', 'Backend inicializado correctamente');
    app.listen(PORT, () => {
      console.log(`🚀 Server backend SQLite corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(console.error);
