const BACKEND_URL = 'http://localhost:8502/api';

export const fetchGraphNodes = async (projectName: string) => {
  const res = await fetch(`${BACKEND_URL}/graph/${projectName}`);
  return res.json();
};

export const saveGraphNodeToSqlite = async (node: any) => {
  await fetch(`${BACKEND_URL}/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(node)
  });
};

export const fetchTaskLogs = async (projectName: string) => {
  const res = await fetch(`${BACKEND_URL}/logs/${projectName}`);
  return res.json();
};

export const saveTaskLogToSqlite = async (log: any) => {
  await fetch(`${BACKEND_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log)
  });
};

export const saveQueryLog = async (projectName: string, query: string, response: string) => {
  const log = {
    task_id: `QUERY-${Date.now()}`,
    project_name: projectName,
    title: `Consulta: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
    markdown_content: `## Consulta\n\`\`\`\n${query}\n\`\`\`\n\n## Respuesta\n\`\`\`\n${response}\n\`\`\`\n\n## Metadata\n- Fecha: ${new Date().toISOString()}\n- Proyecto: ${projectName}\n- Tipo: Consulta de Chat`,
    tags: ['chat', 'consulta', 'query']
  };
  
  await fetch(`${BACKEND_URL}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log)
  });
};
