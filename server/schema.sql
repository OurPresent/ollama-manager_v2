-- Tablas del Grafo de Conocimiento
CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    node_type TEXT NOT NULL, -- 'ENTIDAD', 'COMPONENTE', 'SERVICIO', 'MODULO'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Registro de Consultas y Snippets SQL/Código
CREATE TABLE IF NOT EXISTS project_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    title TEXT NOT NULL,
    raw_query TEXT NOT NULL,
    optimized_query TEXT,
    execution_time_ms REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bitácoras Episódicas (.md)
CREATE TABLE IF NOT EXISTS task_logs (
    task_id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    title TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
    tags TEXT, -- Guardado como JSON Array: ["backend", "sql"]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Proyectos registrados localmente
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- Configuracion global y por proyecto
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_settings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id);

-- Sesiones y mensajes de chat persistentes
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    model_name TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active | archived | error
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL, -- system | user | assistant | tool
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', -- draft | streaming | completed | error
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS chat_actions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    target_path TEXT,
    payload_json TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | success | error
    result_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_actions_message ON chat_actions(message_id);

-- Catalogo y ejecucion de agentes
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT DEFAULT '',
    system_prompt TEXT NOT NULL,
    model TEXT DEFAULT '',
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    project_id TEXT,
    plan_run_id TEXT,
    model_name TEXT,
    status TEXT NOT NULL DEFAULT 'idle', -- idle | running | completed | error
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    output TEXT DEFAULT '',
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, started_at DESC);

-- Planes y ejecuciones
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | archived
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS plan_runs (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    project_id TEXT,
    status TEXT NOT NULL DEFAULT 'running', -- running | completed | error | cancelled
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    summary TEXT DEFAULT '',
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_runs_plan ON plan_runs(plan_id, started_at DESC);

-- Aprobaciones y auditoria
CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    scope_type TEXT NOT NULL, -- file_edit | architecture_decision | dependency_install | plan_execution
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    details_json TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_decisions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    decision TEXT NOT NULL, -- approved | rejected | alternative
    selected_alternative INTEGER,
    feedback TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES approval_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_request ON approval_decisions(request_id);

CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL, -- info | warn | error
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    project_id TEXT,
    details_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);

-- Indice de archivos del proyecto y accesos
CREATE TABLE IF NOT EXISTS file_index (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_type TEXT DEFAULT '',
    size_bytes INTEGER DEFAULT 0,
    modified_at DATETIME,
    hash TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, relative_path)
);

CREATE INDEX IF NOT EXISTS idx_file_index_project ON file_index(project_id, relative_path);

CREATE TABLE IF NOT EXISTS file_access_log (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    source TEXT NOT NULL, -- chat | plan | agent | manual
    details_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_access_log_project ON file_access_log(project_id, created_at DESC);

-- Sesiones y mensajes de OpenCode (historial de consultas por proyecto)
CREATE TABLE IF NOT EXISTS opencode_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    agent TEXT DEFAULT '',
    model TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active', -- active | archived | error
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_opencode_sessions_project ON opencode_sessions(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opencode_sessions_updated ON opencode_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS opencode_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL, -- user | assistant | tool
    content TEXT NOT NULL,
    model TEXT DEFAULT '',
    agent TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES opencode_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opencode_messages_session ON opencode_messages(session_id, created_at);

-- Contexto estructural del proyecto (generado al indexar)
CREATE TABLE IF NOT EXISTS project_context_blocks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    block_type TEXT NOT NULL, -- tree | summary | stats
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT DEFAULT 'indexer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_blocks_project ON project_context_blocks(project_id, block_type);

CREATE TABLE IF NOT EXISTS project_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_project ON project_snapshots(project_id, created_at DESC);

-- Versionado de prompts de agentes
CREATE TABLE IF NOT EXISTS agent_versions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT DEFAULT '',
    system_prompt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id, version DESC);

-- Valores por defecto para arranque del sistema
INSERT INTO app_settings (key, value)
VALUES
    ('theme', 'dark'),
    ('ollama_url', 'http://localhost:11434'),
    ('ollama_mode', 'local'),
    ('opencode_port', '4096'),
    ('opencode_hostname', '127.0.0.1'),
    ('opencode_password', ''),
    ('opencode_auto_start', '0')
ON CONFLICT(key) DO NOTHING;
