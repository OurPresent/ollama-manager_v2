import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export type IntegrationCategory = 'base-datos' | 'backend' | 'auth' | 'browser' | 'queue' | 'devops' | 'ai';

export interface IntegrationCheck {
  type: 'cli' | 'npm' | 'docker';
  name: string;
}

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  docsUrl: string;
  usesLocalhost: boolean;
  checks: IntegrationCheck[];
  setupGuide: string[];
  envVars: Array<{ key: string; hint: string; required: boolean }>;
}

export interface IntegrationStatus extends Integration {
  detected: boolean;
  detectedVia: string[];
  installedNpm: boolean;
}

const detectCommand = (cmd: string): boolean => {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    const res = spawnSync(checker, [cmd], { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
};

const npmInstalled = (pkg: string): boolean => {
  const home = process.env.USERPROFILE || process.env.HOME || process.cwd();
  const candidates = [
    path.join(process.cwd(), 'node_modules', pkg),
    path.join(home, 'node_modules', pkg),
  ];
  return candidates.some((p) => fs.existsSync(p));
};

export const INTEGRATIONS: Integration[] = [
  {
    id: 'supabase',
    name: 'Supabase (local)',
    category: 'auth',
    description: 'PostgreSQL + Auth + Storage autoalojado con el CLI oficial. Todo corre en local vía Docker.',
    docsUrl: 'https://supabase.com/docs/guides/cli/getting-started',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'supabase' },
      { type: 'npm', name: '@supabase/supabase-js' },
    ],
    setupGuide: [
      'Instala el CLI: npm install -g supabase',
      'Inicializa el proyecto: supabase init',
      'Levanta el stack local: supabase start',
      'Copia SUPABASE_URL y SUPABASE_ANON_KEY (por defecto http://127.0.0.1:54321) a tu .env',
      'Instala el cliente: npm install @supabase/supabase-js',
    ],
    envVars: [
      { key: 'SUPABASE_URL', hint: 'http://127.0.0.1:54321', required: true },
      { key: 'SUPABASE_ANON_KEY', hint: 'generada por supabase start', required: true },
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase Emulators',
    category: 'auth',
    description: 'Auth, Firestore y Functions en emuladores locales de Firebase (sin tocar la nube).',
    docsUrl: 'https://firebase.google.com/docs/emulator-suite',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'firebase' },
      { type: 'npm', name: 'firebase' },
    ],
    setupGuide: [
      'Instala el CLI: npm install -g firebase-tools',
      'Inicializa: firebase init (elige Auth / Firestore / Functions emulators)',
      'Lanza los emuladores: firebase emulators:start',
      'Las APIs apuntan a http://127.0.0.1:4000 (UI) y sus puertos por servicio',
    ],
    envVars: [
      { key: 'FIREBASE_EMULATOR_HOST', hint: '127.0.0.1', required: false },
      { key: 'FIREBASE_PROJECT_ID', hint: 'demo-local', required: false },
    ],
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'base-datos',
    description: 'Base de datos relacional local vía Docker o instalación nativa.',
    docsUrl: 'https://www.postgresql.org/docs/',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'psql' },
      { type: 'docker', name: 'postgres' },
    ],
    setupGuide: [
      'Con Docker: docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16',
      'Con instalación nativa: instala PostgreSQL y arranca el servicio',
      'Crea la BD: createdb app',
      'Conecta con psql postgres://postgres:postgres@127.0.0.1:5432/app',
    ],
    envVars: [
      { key: 'DATABASE_URL', hint: 'postgres://postgres:postgres@127.0.0.1:5432/app', required: true },
    ],
  },
  {
    id: 'mysql',
    name: 'MySQL / MariaDB',
    category: 'base-datos',
    description: 'Base de datos relacional local compatible con MySQL 8.',
    docsUrl: 'https://dev.mysql.com/doc/',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'mysql' },
      { type: 'docker', name: 'mysql' },
    ],
    setupGuide: [
      'Con Docker: docker run -d --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8',
      'Crea la BD: mysql -u root -proot -e "CREATE DATABASE app"',
      'Conecta con mysql://root:root@127.0.0.1:3306/app',
    ],
    envVars: [
      { key: 'MYSQL_URL', hint: 'mysql://root:root@127.0.0.1:3306/app', required: true },
    ],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'base-datos',
    description: 'Base NoSQL local vía Docker o instalación nativa.',
    docsUrl: 'https://www.mongodb.com/docs/manual/',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'mongod' },
      { type: 'docker', name: 'mongo' },
    ],
    setupGuide: [
      'Con Docker: docker run -d --name mongo -p 27017:27017 mongo:7',
      'Con instalación nativa: instala MongoDB Community y arranca el servicio',
      'Conecta con mongodb://127.0.0.1:27017/app',
    ],
    envVars: [
      { key: 'MONGODB_URL', hint: 'mongodb://127.0.0.1:27017/app', required: true },
    ],
  },
  {
    id: 'redis',
    name: 'Redis',
    category: 'queue',
    description: 'Cache y colas en memoria local (BullMQ, ioredis).',
    docsUrl: 'https://redis.io/docs/latest/',
    usesLocalhost: true,
    checks: [
      { type: 'cli', name: 'redis-server' },
      { type: 'docker', name: 'redis' },
    ],
    setupGuide: [
      'Con Docker: docker run -d --name redis -p 6379:6379 redis:7',
      'Con instalación nativa: instala Redis y arranca redis-server',
      'Conecta con redis://127.0.0.1:6379',
    ],
    envVars: [
      { key: 'REDIS_URL', hint: 'redis://127.0.0.1:6379', required: true },
    ],
  },
  {
    id: 'docker',
    name: 'Docker',
    category: 'devops',
    description: 'Motor de contenedores para levantar servicios locales (Postgres, Redis, etc.).',
    docsUrl: 'https://docs.docker.com/',
    usesLocalhost: true,
    checks: [{ type: 'cli', name: 'docker' }],
    setupGuide: [
      'Instala Docker Desktop (Windows/macOS) o el engine en Linux',
      'Verifica: docker run hello-world',
      'Úsalo como base para levantar las demás integraciones',
    ],
    envVars: [],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer / Playwright',
    category: 'browser',
    description: 'Automatización de navegador headless para screenshots y scraping.',
    docsUrl: 'https://pptr.dev/',
    usesLocalhost: true,
    checks: [
      { type: 'npm', name: 'puppeteer' },
      { type: 'npm', name: 'playwright' },
    ],
    setupGuide: [
      'Instala: npm install puppeteer',
      'Primera ejecución descarga Chromium automáticamente',
      'Playwright: npm install playwright && npx playwright install',
    ],
    envVars: [],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    category: 'ai',
    description: 'Modelos de lenguaje locales (llama, mistral, etc.) con API REST en 127.0.0.1:11434.',
    docsUrl: 'https://ollama.com/library',
    usesLocalhost: true,
    checks: [{ type: 'cli', name: 'ollama' }],
    setupGuide: [
      'Descarga e instala Ollama desde ollama.com',
      'Descarga un modelo: ollama pull llama3.1',
      'El servidor expone /api/chat en http://127.0.0.1:11434',
    ],
    envVars: [
      { key: 'OLLAMA_BASE_URL', hint: 'http://127.0.0.1:11434', required: false },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'ai',
    description: 'Agente de codificación por terminal, integrado con sesiones e historial de este proyecto.',
    docsUrl: 'https://opencode.ai/docs/',
    usesLocalhost: false,
    checks: [{ type: 'cli', name: 'opencode' }],
    setupGuide: [
      'Instala el binario de opencode en tu PATH',
      'Configura los permisos de herramientas en la vista OpenCode',
      'Apunta tus modelos a Ollama u OpenAI-compatibles',
    ],
    envVars: [],
  },
];

const matchChecks = (integration: Integration): string[] => {
  const detectedVia: string[] = [];
  for (const check of integration.checks) {
    if (check.type === 'cli' && detectCommand(check.name)) detectedVia.push(`CLI: ${check.name}`);
    if (check.type === 'npm' && npmInstalled(check.name)) detectedVia.push(`npm: ${check.name}`);
    if (check.type === 'docker' && detectCommand('docker')) detectedVia.push('docker disponible');
  }
  return detectedVia;
};

export const getCatalog = (): IntegrationStatus[] => {
  return INTEGRATIONS.map((integration) => {
    const detectedVia = matchChecks(integration);
    const installedNpm = integration.checks.some((c) => c.type === 'npm' && npmInstalled(c.name));
    return {
      ...integration,
      detected: detectedVia.length > 0,
      detectedVia,
      installedNpm,
    };
  });
};

export const getIntegration = (id: string): Integration | undefined => {
  return INTEGRATIONS.find((i) => i.id === id);
};

export const getIntegrationStatus = (id: string): IntegrationStatus | undefined => {
  const integration = getIntegration(id);
  if (!integration) return undefined;
  return getCatalog().find((i) => i.id === id);
};

export const buildGuideMarkdown = (status: IntegrationStatus): string => {
  const lines: string[] = [
    `# ${status.name}`,
    '',
    status.description,
    '',
    `- Estado: ${status.detected ? 'Detectada en el equipo' : 'No detectada'}`,
    status.detectedVia.length > 0 ? `- Vía: ${status.detectedVia.join(', ')}` : '- Vía: ninguna',
    `- Local: ${status.usesLocalhost ? 'sí (127.0.0.1)' : 'no'}`,
    '',
    '## Configuración',
    ...status.setupGuide.map((s, i) => `${i + 1}. ${s}`),
  ];

  if (status.envVars.length > 0) {
    lines.push('', '## Variables de entorno', '');
    for (const env of status.envVars) {
      lines.push(`- \`${env.key}\`${env.required ? ' *(requerida)*' : ''} — ${env.hint}`);
    }
  }

  lines.push('', `## Documentación`, '', status.docsUrl, '');
  return lines.join('\n');
};
