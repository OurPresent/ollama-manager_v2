# 🚀 LLMX v2 - Control Center Local

**Orquestación local de Modelos, Agentes y Grafos de Memoria con Python**

LLMX v2 es una aplicación web completa para gestionar modelos de lenguaje locales (Ollama), ejecutar pipelines de agentes especializados, mantener un grafo de conocimiento persistente de tus proyectos, y realizar operaciones de archivos reales mediante Python.

## ✨ Características

- **🤖 Chat con Memoria Contextual**: Consulta tu código con IA que inyecta automáticamente el contexto del proyecto (bitácoras, entidades, componentes)
- **🐍 Acciones de Sistema con Python**: El LLM puede crear, leer, escribir, eliminar y listar archivos dentro del proyecto activo mediante bloques `<action>`
- **🐳 Control de Docker con Python**: Inicia, detiene, reinicia y monitorea Ollama en Docker o Local desde la interfaz
- **🔗 Pipeline de Agentes**: Ejecuta flujos de trabajo automáticos con agentes especializados (PM, Backend, Frontend, QA, DevOps) que pueden crear archivos reales
- **📦 Gestor Ollama**: Descarga, elimina y gestiona modelos LLM locales directamente desde la interfaz
- **🧪 Playground**: Prueba modelos con parámetros personalizados (temperature, top_p, etc.)
- **📊 Historial Completo**: Revisa todas las consultas, agentes ejecutados y cambios en el grafo de conocimiento
- **💾 Memoria Persistente**: Base de datos SQLite local que evoluciona con cada interacción
- **🎨 Tema Claro/Oscuro/Sistema**: Interfaz con tema claro (amarillo + celeste) y tema oscuro (verde + azul), con detección automática del sistema

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLMX v2 Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │   Frontend   │      │   Backend    │      │   Ollama     │   │
│  │   (Vite)     │◄────►│  (Express)   │◄────►│   Server     │   │
│  │   Port 8502  │      │   Port 8502  │      │  Port 11434  │   │
│  │  React + TS  │      │  TypeScript  │      │  Docker/Local│   │
│  └──────────────┘      └──────┬───────┘      └──────────────┘   │
│         │                      │                                │
│         │                      │                                │
│         │                ┌─────┴──────┐                         │
│         │                │  Python    │                         │
│         │                │ actions.py │                         │
│         │                │            │                         │
│         │                │ 📁 Files   │                        │
│         │                │ 🐳 Docker  │                        │
│         │                └────────────┘                         │
│         │                                                       │
│  ┌──────┴────────┐      ┌──────────────┐                        │
│  │  Tailwind CSS │      │  SQLite DB   │                        │
│  │  Light/Dark   │      │  (sql.js)    │                        │
│  │  Theme System │      │  memory.db   │                        │
│  └───────────────┘      └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Requisitos Previos

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (o npm/yarn)
- **Python** >= 3.8 (para acciones de sistema y control de Docker)
- **Ollama** instalado y corriendo en http://localhost:11434
- **Docker** (opcional, para ejecutar Ollama en contenedor)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/OurPresent/ollama-manager_v2.git
cd ollama-manager_v2
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno (opcional)

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_OLLAMA_URL=http://localhost:11434
```

### 4. Iniciar la aplicación

```bash
# Desarrollo (frontend + backend simultáneamente)
pnpm dev

# O iniciar por separado:
pnpm dev:frontend  # Solo frontend (http://localhost:8502)
pnpm dev:backend   # Solo backend (http://localhost:8502)
```

### 5. Abrir en el navegador

La aplicación se abrirá automáticamente en: **http://localhost:8502**

## 📦 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia frontend y backend simultáneamente |
| `pnpm dev:frontend` | Inicia solo el servidor Vite (puerto 8502) |
| `pnpm dev:backend` | Inicia solo el servidor Express (puerto 8502) |

## 🐍 Integración con Python

### Acciones de Archivos

El LLM puede realizar operaciones de archivos dentro del proyecto activo usando bloques `<action>` en sus respuestas. Estas acciones son ejecutadas automáticamente por Python.

**Acciones disponibles:**

| Acción | Descripción | Parámetros |
|--------|-------------|------------|
| `write_file` | Crear o sobrescribir un archivo | `path`, `content` |
| `create_file` | Crear un archivo nuevo | `path`, `content` |
| `read_file` | Leer el contenido de un archivo | `path` |
| `append_file` | Añadir contenido al final de un archivo | `path`, `content` |
| `delete_file` | Eliminar un archivo | `path` |
| `create_directory` | Crear un directorio | `path` |
| `list_files` | Listar archivos en un directorio | `path` |
| `get_file_info` | Obtener información de un archivo | `path` |

**Ejemplo de uso del LLM:**

```
<action>
{"action": "write_file", "path": "src/components/Button.tsx", "content": "import React from 'react';\n\nexport const Button = () => ..."}
</action>
```

### Control de Docker/Ollama

Python maneja el control completo de Docker para Ollama:

| Acción Python | Endpoint | Descripción |
|---------------|----------|-------------|
| `docker_check_ollama` | `GET /api/docker/ollama/status` | Verifica si Ollama está corriendo (Docker o Local) |
| `docker_start_ollama` | `POST /api/docker/ollama/start` | Inicia el contenedor Docker de Ollama |
| `docker_stop_ollama` | `POST /api/docker/ollama/stop` | Detiene el contenedor Docker de Ollama |
| `docker_restart_ollama` | `POST /api/docker/ollama/restart` | Reinicia el contenedor Docker de Ollama |
| `docker_get_info` | `GET /api/docker/info` | Información completa de Docker (versión, contenedores, puertos) |

**Seguridad:** Todas las operaciones de archivos están limitadas al directorio del proyecto activo. Los intentos de path traversal son bloqueados.

## 🎨 Tema Claro/Oscuro

La aplicación soporta tres modos de tema:

- **Oscuro**: Interfaz oscura con acentos verdes (emerald) y azules
- **Claro**: Interfaz blanca con acentos amarillos (amber) y celestes (sky)
- **Sistema**: Se adapta automáticamente a la preferencia del sistema operativo

El tema se aplica antes del renderizado (sin parpadeo) mediante un script inline en `index.html`, y se persiste en `localStorage`.

**Para cambiar el tema:** Configuración → Apariencia → Seleccionar tema

## 🗄️ Base de Datos

La aplicación utiliza **SQLite** (a través de sql.js) para almacenar:

### Tablas

1. **graph_nodes**: Grafo de conocimiento del proyecto
   - Entidades, Componentes, Servicios, Módulos
   - Relaciones y metadatos

2. **project_queries**: Registro de consultas SQL
   - Queries originales y optimizadas
   - Tiempos de ejecución

3. **task_logs**: Bitácoras episódicas en Markdown
   - Tareas del proyecto
   - Tags y metadatos

### Ubicación

```
server/
├── memory.db          # Base de datos SQLite
├── schema.sql         # Esquema de la base de datos
└── actions.py         # Script de Python para acciones de sistema
```

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript 5** - Tipado estático
- **Vite 5** - Build tool y dev server
- **Tailwind CSS 3** - Estilos utility-first con dark mode
- **Lucide React** - Iconos

### Backend
- **Express 4** - Servidor web
- **SQLite (sql.js)** - Base de datos
- **CORS** - Manejo de cross-origin requests
- **TSX** - Ejecución de TypeScript en Node.js
- **child_process (spawn)** - Ejecución de scripts Python

### Python
- **Python 3.8+** - Script de acciones de sistema
- **subprocess** - Control de Docker
- **os / json** - Operaciones de archivos y parsing

### DevOps
- **Concurrently** - Ejecución paralela de scripts
- **pnpm** - Gestor de paquetes

## 📁 Estructura del Proyecto

```
ollama-manager-v2/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Sidebar.tsx      # Barra lateral con control Docker
│   │   └── MetricCard.tsx   # Cards de métricas
│   ├── services/            # Lógica de negocio
│   │   ├── ollama.ts        # Cliente de Ollama
│   │   ├── dockerControl.ts # Control de Docker (Python)
│   │   ├── fileActions.ts   # Acciones de archivos (Python)
│   │   ├── memoryDb.ts      # Base de datos local
│   │   ├── apiDb.ts         # Cliente del backend
│   │   ├── approvalSystem.ts # Sistema de aprobaciones
│   │   └── fileReference.ts # Referencias de archivos ($)
│   ├── types/               # Tipos TypeScript
│   │   └── index.ts
│   ├── views/               # Vistas principales
│   │   ├── HomeView.tsx     # Dashboard
│   │   ├── ChatView.tsx     # Chat con acciones Python
│   │   ├── AgentsView.tsx   # Gestor de agentes
│   │   ├── PlanesView.tsx   # Pipeline con acciones Python
│   │   ├── OllamaView.tsx   # Gestor de modelos
│   │   ├── PlaygroundView.tsx # Testing de prompts
│   │   ├── HistoryView.tsx  # Historial y grafo
│   │   └── SettingsView.tsx # Configuración + Docker info
│   ├── App.tsx              # Componente principal
│   ├── main.tsx             # Entry point
│   └── index.css            # Estilos globales
├── server/
│   ├── index.ts             # Servidor Express + endpoints Python
│   ├── actions.py           # Script Python (archivos + Docker)
│   ├── db.ts                # Conexión SQLite
│   ├── types.d.ts           # Tipos para sql.js
│   └── schema.sql           # Esquema de base de datos
├── public/
│   └── vite.svg             # Favicon
├── index.html               # HTML con script anti-FOUC
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js       # darkMode: 'class'
├── postcss.config.js
└── README.md
```

## 🎯 Guía de Uso

### 1. Configurar Proyecto Activo
- En la barra lateral, escribe el nombre del proyecto o selecciona una carpeta
- La ruta del proyecto se usa para todas las acciones de Python (archivos)
- El indicador "Python activo" confirma que las acciones están habilitadas

### 2. Chat del Proyecto
- Selecciona un modelo de la lista de Ollama
- Escribe tu consulta sobre el código
- El sistema inyecta automáticamente el contexto del proyecto
- El LLM puede crear/modificar archivos usando bloques `<action>`
- Usa `$nombre-archivo` para referenciar archivos en tu consulta

### 3. Gestor de Agentes
- Administra y configura agentes especializados
- Revisa los system prompts de cada agente
- Los agentes se ejecutan con Ollama local

### 4. Ejecución de Planes
- Define un objetivo y genera un plan técnico con IA
- Ejecuta el pipeline secuencial de agentes (PM → Backend → Frontend → DBA → QA → DevOps)
- Cada agente puede crear archivos reales en el proyecto mediante Python
- Auditoría final sintetiza la bitácora y actualiza el grafo de memoria

### 5. Gestor Ollama
- Descarga nuevos modelos desde Ollama Hub
- Elimina modelos que no necesites
- Visualiza el tamaño y fecha de cada modelo

### 6. Configuración
- **Apariencia**: Cambia entre tema Oscuro, Claro o Sistema
- **Endpoints**: Configura la URL de Ollama y el modo (Docker/Local)
- **Docker/Ollama (Python)**: Inicia, detiene o reinicia Ollama
- **Información**: Visualiza estado de Docker, contenedores, puertos y versión

### 7. Historial
- Revisa todas las consultas realizadas
- Visualiza agentes ejecutados
- Explora la evolución del grafo de conocimiento

## 🔧 Configuración Avanzada

### Cambiar el puerto

Edita `vite.config.ts` para el frontend:
```typescript
server: {
  port: 8502, // Cambiar este valor
}
```

Edita `server/index.ts` para el backend:
```typescript
const PORT = 8502; // Cambiar este valor
```

### Conectar a Ollama remoto

Edita el archivo `.env`:
```env
VITE_OLLAMA_URL=http://tu-servidor-ollama:11434
```

### Validación antes de guardar configuración

La aplicación valida si Ollama está corriendo antes de permitir guardar cambios en la configuración. Si está en ejecución, muestra una advertencia indicando que debe detener el servicio primero.

## 🐛 Troubleshooting

### Error: "Python is not installed"
1. Verifica que Python esté instalado: `python --version`
2. Asegúrate de que Python esté en el PATH del sistema
3. Se requiere Python 3.8 o superior

### Error: "Docker is not installed or not in PATH"
1. Verifica que Docker esté instalado: `docker --version`
2. Asegúrate de que Docker Desktop esté corriendo
3. Verifica que Docker esté en el PATH del sistema

### Error: "Ollama no está disponible"
1. Verifica que Ollama esté instalado: `ollama --version`
2. Inicia el servidor: `ollama serve` o usa el botón "Iniciar Ollama" en la app
3. Verifica que esté en http://localhost:11434
4. Si usas Docker: `docker start ollama`

### Error: "Puerto 8502 en uso"
Cambia el puerto en `vite.config.ts` y `server/index.ts`

### Error: "Access denied: path is outside project directory"
Esta es una medida de seguridad. Las acciones de Python solo pueden operar dentro del directorio del proyecto activo. Verifica que la ruta del proyecto sea correcta.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Add: nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👨‍💻 Autor

Desarrollado con ❤️ para la comunidad de LLMs locales

## 🙏 Agradecimientos

- [Ollama](https://ollama.ai/) - Por hacer accesible los LLMs locales
- [sql.js](https://github.com/sql-js/sql.js) - SQLite en el navegador/Node
- [Lucide](https://lucide.dev/) - Iconos hermosos y consistentes
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utility-first
- [Python](https://python.org/) - Por ser el puente entre el LLM y el sistema

---

**⭐ Si te gusta este proyecto, dale una estrella en GitHub**