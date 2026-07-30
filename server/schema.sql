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