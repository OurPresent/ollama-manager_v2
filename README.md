# 🚀 LLMX v2 - Control Center Local

**Orquestación local de Modelos, Agentes y Grafos de Memoria con Python**

LLMX v2 es una aplicación web completa para gestionar modelos de lenguaje locales (Ollama), ejecutar pipelines de agentes especializados, mantener un grafo de conocimiento persistente de tus proyectos, y realizar operaciones de archivos reales mediante Python.

## ✨ Características

- **🤖 Chat con Memoria Contextual**: Consulta tu código con IA que inyecta automáticamente el contexto del proyecto (bitácoras, entidades, componentes)
- **🐍 Acciones de Sistema con Python**: El LLM puede crear, leer, escribir, eliminar y listar archivos dentro del proyecto activo mediante bloques `<action>`
- **🐳 Control de Docker con Python**: Inicia, detiene, reinicia y monitorea Ollama en Docker o Local desde la interfaz
- **📦 Sección Ollama unificada**: Inicia/detiene el servicio Ollama (Docker o Local), lista, descarga y elimina modelos, y muestra cuáles están cargados en memoria
- **🔗 Pipeline de Agentes**: Ejecuta flujos de trabajo automáticos con agentes especializados (PM, Backend, Frontend, DBA, QA, DevOps) que pueden crear archivos reales
- **🎯 Selección y orquestación de agentes**: Activa/desactiva agentes con un switch (persistido en SQLite) y elige qué agentes y en qué orden participan en cada plan, organizados por funcionalidad
- **📊 Dashboard de consumo real**: En Inicio se muestra la RAM en uso, el modelo que más memoria consume y el uso histórico por modelo (sesiones, mensajes y corridas)
- **🧪 Playground**: Prueba modelos con parámetros personalizados (temperature, top_p, etc.)
- **📊 Historial Completo**: Revisa todas las consultas, agentes ejecutados y cambios en el grafo de conocimiento
- **💾 Memoria Persistente**: Base de datos SQLite local que evoluciona con cada interacción (un solo backend, sin localStorage)
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
| `system_stats` | `GET /api/system/stats` | Estadísticas del sistema: RAM total/uso/libre, % en uso y RAM del proceso Ollama |

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

2. **projects**: Proyectos registrados y proyecto activo
   - Rutas, metadatos y estados
   - Registro de activación de proyecto

3. **agents**: Agentes especializados del pipeline
   - Nombre, rol, system prompt, modelo asignado
   - `is_active`: controla si el agente se ejecuta en los planes

4. **app_settings / project_settings**: Configuración global y por proyecto

5. **chat_sessions / chat_messages**: Sesiones y mensajes del chat
   - Registran el modelo usado en cada consulta (fuente del uso histórico)

6. **agent_runs**: Ejecuciones de agentes en los planes
   - Modelo usado y resultados (fuente del uso histórico)

7. **task_logs**: Bitácoras episódicas en Markdown
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
│   │   ├── systemApi.ts     # Cliente del backend (agentes, sistema, stats)
│   │   ├── approvalSystem.ts # Sistema de aprobaciones
│   │   └── fileReference.ts # Referencias de archivos ($)
│   ├── types/               # Tipos TypeScript
│   │   ├── index.ts
│   │   └── dto.ts           # DTOs del backend (SystemStats, ModelUsage)
│   ├── views/               # Vistas principales
│   │   ├── HomeView.tsx     # Dashboard con consumo de RAM y modelos
│   │   ├── ChatView.tsx     # Chat con acciones Python
│   │   ├── AgentsView.tsx   # Gestor de agentes + switch activación
│   │   ├── PlanesView.tsx   # Pipeline con selección/orquestación de agentes
│   │   ├── OllamaView.tsx   # Gestor de modelos y servicio
│   │   ├── PlaygroundView.tsx # Testing de prompts
│   │   ├── HistoryView.tsx  # Historial y grafo
│   │   └── SettingsView.tsx # Configuración + Docker info
│   ├── App.tsx              # Componente principal (estado central de agentes)
│   ├── main.tsx             # Entry point
│   └── index.css            # Estilos globales
├── server/
│   ├── index.ts             # Servidor Express + montado de rutas
│   ├── actions.py           # Script Python (archivos + Docker + system_stats)
│   ├── db.ts                # Conexión SQLite
│   ├── types.d.ts           # Tipos para sql.js
│   ├── schema.sql           # Esquema de base de datos
│   ├── core/                # Tipos y utilidades del dominio
│   ├── repositories/        # Acceso a datos (agentes, etc.)
│   ├── routes/              # Rutas Express (agents, ollama, docker, system, chat)
│   └── services/            # Servicios (ollama, pythonRunner, systemStats, modelUsage)
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

### 1. Inicio (Dashboard)
- Visualiza métricas en vivo: modelos instalados, agentes activos/total, **RAM en uso** y estado del servidor
- **Dashboard de consumo real**: RAM total/libre/en uso con barra de colores, RAM del proceso Ollama, el modelo con mayor consumo en memoria y el uso histórico por modelo (sesiones, mensajes, corridas)
- Accesos rápidos a Chat, Agentes, Planes y Ollama

### 2. Configurar Proyecto Activo
- En la barra lateral, escribe el nombre del proyecto o selecciona una carpeta
- La ruta del proyecto se usa para todas las acciones de Python (archivos)
- El indicador "Python activo" confirma que las acciones están habilitadas

### 3. Chat del Proyecto
- Selecciona un modelo de la lista de Ollama
- Escribe tu consulta sobre el código
- El sistema inyecta automáticamente el contexto del proyecto
- El LLM puede crear/modificar archivos usando bloques `<action>`
- Usa `$nombre-archivo` para referenciar archivos en tu consulta

### 4. Gestor de Agentes
- Administra y configura agentes especializados
- Revisa los system prompts de cada agente y asigna el modelo de cada uno
- Usa el **switch** para activar/desactivar un agente: los desactivados quedan visibles pero no se ejecutan en los planes (cambio persistido en SQLite)

### 5. Ejecución de Planes
- Define un objetivo y genera un plan técnico con IA
- **Selecciona los agentes** que participarán en el plan y reordénalos (↑/↓) según la funcionalidad del proyecto
- La orquestación por rol sigue el orden: PM → Backend → Frontend → DBA → QA → DevOps
- Cada agente puede crear archivos reales en el proyecto mediante Python
- Auditoría final sintetiza la bitácora y actualiza el grafo de memoria

### 6. Gestor Ollama
- Inicia/detiene el servicio Ollama (Docker o Local) desde la interfaz
- Descarga nuevos modelos desde Ollama Hub y elimina los que no necesites
- Visualiza el tamaño de cada modelo y cuáles están cargados en memoria (RAM/VRAM)

### 7. Configuración
- **Apariencia**: Cambia entre tema Oscuro, Claro o Sistema
- **Endpoints**: Configura la URL de Ollama y el modo (Docker/Local)
- **Docker/Ollama (Python)**: Inicia, detiene o reinicia Ollama
- **Información**: Visualiza estado de Docker, contenedores, puertos y versión

### 8. Historial
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