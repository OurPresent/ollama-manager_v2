# 🚀 Ollama Manager v2

**Control Center Local: Modelos, Agentes, Planes y OpenCode**

Aplicación web de escritorio local para gestionar modelos de lenguaje (Ollama), ejecutar agentes especializados, orquestar planes de desarrollo, chatear con contexto de proyecto y operar el agente autónomo **OpenCode** — todo con una sola base de datos SQLite local.

## ✨ Características

- **🤖 Chat con Memoria Contextual**: consulta tu código con IA que inyecta automáticamente el contexto del proyecto (estructura, resumen, bitácoras)
- **⚙️ Gestión de Ollama**: inicia/detiene el servicio (Local o Docker), lista, descarga y elimina modelos, y muestra cuáles están cargados en memoria
- **🔗 Pipeline de Agentes**: agentes especializados persistidos en SQLite (PM, Backend, Frontend, DBA, QA, DevOps), con switch de activación y asignación de modelo por agente
- **📥 Carga masiva (JSON)**: importa y exporta **skills** y **agentes** desde un archivo JSON en la vista Agentes, con validación de headers y resultado detallado (importados/actualizados/omitidos/errores). Los skills instalados se escriben como `SKILL.md` en `.opencode/skills` del proyecto activo o en `~/.agents/skills` (global)
- **🧩 Integraciones**: sección dedicada a detectar herramientas locales (Docker, PostgreSQL, Redis, MongoDB, Ollama, OpenCode, Supabase, Firebase, Puppeteer, …), con guías de configuración paso a paso, variables de entorno copiables y enlaces a documentación — pensada como ecosistema de trabajo local
- **🪄 Integración OpenCode**: chat, sesiones, historial en SQLite, comandos y **auto-aprobaciones** (lectura/edición/terminal/navegador/búsquedas web) con modo "auto" global, editable desde la pestaña Configuración
- **📊 Dashboard de consumo real**: RAM en uso, modelo con mayor consumo y uso histórico por modelo (sesiones, mensajes y corridas)
- **💾 Memoria Persistente**: una sola base SQLite (`server/memory.db`) respaldada con **exportar/importar respaldo** desde Configuración → Respaldos
- **📱 Sección Dispositivo**: información del equipo (SO, CPU, RAM, uptime), análisis del entorno ("preparar entorno") y estado de herramientas (Node, npm, Ollama, OpenCode, Docker, Git)
- **🎨 Tema Claro/Oscuro/Sistema**

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                      Ollama Manager v2                           │
├──────────────────────────────────────────────────────────────────┤
│   Frontend (Vite · React · TS)          Backend (Express · TS)   │
│   http://localhost:8503 ──────────────► http://localhost:8502    │
│                                            │                     │
│                                            ├──► Ollama (11434)   │
│                                            ├──► OpenCode (4096)  │
│                                            ├──► SQLite (sql.js)  │
│                                            │      memory.db      │
│                                            └──► Sistema (Python) │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

> El backend sirve tanto la API (`/api/*`) como el frontend compilado en producción, en el puerto **8502**.

## 📋 Requisitos Previos

- **Node.js** >= 18.0.0 y **npm** (o **pnpm**)
- **Ollama** instalado y corriendo en `http://localhost:11434` (necesario para modelos locales)
- **OpenCode** CLI instalado y en el PATH (necesario para el tab OpenCode)
- **Docker** (opcional, para ejecutar Ollama en contenedor)
- **Git** (opcional)

## 🚀 Instalación por Sistema Operativo

### 🪟 Windows

1. **Node.js**: descarga el instalador LTS desde [nodejs.org](https://nodejs.org/). Marca la opción *"Add to PATH"* durante la instalación.
2. **Ollama**: descarga desde [ollama.com/download](https://ollama.com/download). Tras instalarlo, el servicio arranca solo en `http://localhost:11434`.
3. **OpenCode**: instala la CLI globalmente:
   ```bash
   npm install -g opencode-ai
   ```
4. Abre **PowerShell** (o Git Bash / CMD) en la carpeta del proyecto:
   ```bash
   npm install        # o: pnpm install
   npm run dev
   ```
5. Abre **http://localhost:8502**.

> 💡 En Windows usa PowerShell como administrador si algún comando requiere permisos. Si usas el modo Docker, instala **Docker Desktop** desde [docker.com](https://www.docker.com/products/docker-desktop/).

### 🍎 macOS

1. **Node.js** (recomendado con Homebrew):
   ```bash
   brew install node
   ```
2. **Ollama**:
   ```bash
   brew install ollama && brew services start ollama
   ```
   o descarga el .dmg desde [ollama.com/download](https://ollama.com/download).
3. **OpenCode**:
   ```bash
   npm install -g opencode-ai
   ```
4. Instala dependencias y ejecuta:
   ```bash
   npm install && npm run dev
   ```
5. Abre **http://localhost:8502**.

### 🐧 Linux (Debian/Ubuntu)

1. **Node.js** (desde el repositorio oficial):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. **Ollama** (instalador oficial):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
3. **OpenCode**:
   ```bash
   npm install -g opencode-ai
   ```
4. Instala dependencias y ejecuta:
   ```bash
   npm install && npm run dev
   ```
5. Abre **http://localhost:8502**.

### 📦 Todos los sistemas (resumen)

```bash
git clone https://github.com/OurPresent/ollama-manager_v2.git
cd ollama-manager_v2
npm install
npm run dev
```

## 📖 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia backend + frontend simultáneamente |
| `npm run dev:frontend` | Solo Vite dev server (puerto 8503) |
| `npm run dev:backend` | Solo Express server (puerto 8502) |

## 🔗 Documentación Oficial

| Herramienta | Documentación |
|-------------|---------------|
| **Ollama** | [docs.ollama.com](https://docs.ollama.com/) |
| **OpenCode** | [opencode.ai/docs](https://opencode.ai/docs/) |
| — Permisos / auto-aprobaciones | [opencode.ai/docs/permissions](https://opencode.ai/docs/permissions/) |
| — Configuración (`opencode.json`) | [opencode.ai/docs/config](https://opencode.ai/docs/config/) |
| — Providers | [opencode.ai/docs/providers](https://opencode.ai/docs/providers/) |
| **Docker** | [docs.docker.com](https://docs.docker.com/) |
| **Node.js** | [nodejs.org/docs](https://nodejs.org/en/docs) |

## 🪄 Integración con OpenCode

OpenCode es el agente autónomo integrado en el tab *OpenCode* de la app. Para usarlo:

1. Asegúrate de tener la CLI instalada: `opencode --version`
2. En la app, ve a **OpenCode → Estado → Iniciar servidor**
3. En **Configuración**, conecta el provider de Ollama (botón *"Aplicar provider"*)
4. Configura las **auto-aprobaciones**: activa el **modo auto** para que OpenCode lea/edite archivos, ejecute comandos y navegue sin pedir confirmación, o ajusta cada acción por separado (`allow` / `ask` / `deny`)
5. Abre un chat de sesión y escribe tu consulta. Los mensajes y el historial quedan persistidos en SQLite.

### Auto-aprobaciones

El bloque `permission` de `opencode.json` controla qué acciones se aprueban automáticamente:

| Acción | Clave | Valores |
|--------|-------|---------|
| Lectura de archivos | `read` | `allow` \| `ask` \| `deny` |
| Edición de archivos | `edit` | `allow` \| `ask` \| `deny` |
| Comandos en terminal | `bash` | `allow` \| `ask` \| `deny` |
| Navegador / webfetch | `webfetch` | `allow` \| `ask` \| `deny` |
| Búsquedas web | `websearch` | `allow` \| `ask` \| `deny` |

Con el **modo auto-aprobación activado** se escribe `"permission": { "*": "allow" }`. Es cómodo para flujos autónomos, pero **usa un scope de proyecto** y revisa los comandos que ejecuta.

## 📥 Carga masiva de Skills y Agentes

En la vista **Agentes** tienes la card *Carga masiva (JSON)* con dos pestañas: **Skills** y **Agentes**.

- **Skills**: array de objetos con headers obligatorios `name` (slug válido: letras, números, guiones) y `content` (instrucciones en Markdown). Opcionales: `description`, `references` (array de `{ path, content }`), `scope` (`project` | `global`) y `enabled`. Al importar, los skills nuevos/actualizados se instalan automáticamente como `SKILL.md` en el proyecto activo (`.opencode/skills`) y quedan listados en el modal *Skills instalados*, donde puedes instalarlos también en global (`~/.agents/skills`), activar/desactivar, desinstalar o eliminar.
- **Agentes**: array de objetos con headers obligatorios `name`, `role` y `systemPrompt` (opcionales: `description`, `model`). Si no asignas modelo, el agente usa el **modelo global** preseleccionado.
- **Validar**: comprueba headers y sintaxis sin persistir. **Importar**: inserta/actualiza y te reporta importados, actualizados, omitidos y errores por item. **Exportar**: descarga un `.json` con el catálogo actual.

El botón *ver formato* muestra los headers y un ejemplo listo para pegar.

## 🧩 Integraciones (ecosistema local)

La vista **Integraciones** (barra lateral) te muestra un catálogo de servicios y herramientas que puedes ejecutar en local — todo sin tocar la nube:

- **Supabase (local)**, **Firebase Emulators**, **PostgreSQL**, **MySQL/MariaDB**, **MongoDB**, **Redis**, **Docker**, **Puppeteer/Playwright**, **Ollama** y **OpenCode**.
- Cada card indica si la herramienta fue **detectada** en tu equipo (CLI disponible, paquete npm instalado o Docker presente).
- **Ver guía** genera un markdown con pasos de configuración, variables de entorno y documentación oficial.
- **Copiar variables** coloca las `.env` correspondientes en el portapapeles.
- **Re-detectar** vuelve a comprobar la disponibilidad local de cada integración.

## 🗄️ Base de Datos y Respaldos

SQLite (vía sql.js) en `server/memory.db`. Tablas principales: `graph_nodes`, `projects`, `agents`, `skills`, `app_settings`, `chat_sessions`, `chat_messages`, `agent_runs`, `opencode_sessions`, `opencode_messages`, `task_logs`, `audit_log`.

**Respaldos** (Configuración → Respaldos):

- **Exportar respaldo**: descarga un archivo JSON con la base completa (base64) + manifest.
- **Importar respaldo**: selecciona el archivo, confirma y se restaura la BD en memoria re-aplicando el esquema.

> ⚠️ Al importar se **reemplaza** la base actual. Haz un respaldo antes de probar.

## 💾 Sección Dispositivo

En **Configuración → Dispositivo**: información del equipo (SO, arquitectura, CPU, RAM, uptime) y botón **"Analizar entorno"** que verifica Node, npm, Ollama, OpenCode, Docker y Git, marcando estado (ok/warning/error) y sugiriendo qué instalar.

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Zustand · Lucide
- **Backend**: Express 4 · SQLite (sql.js) · zod · tsx
- **Orquestación**: Node.js `child_process` · Python (acciones de sistema y Docker) · OpenCode CLI

## 🐛 Troubleshooting

### "Ollama no está disponible"
```bash
ollama --version
ollama serve
```
Verifica que la URL en **Configuración → Endpoints** sea `http://localhost:11434`.

### "OpenCode no está en ejecución"
```bash
opencode --version   # si falla: npm install -g opencode-ai
```
Inicia el servidor desde la pestaña OpenCode → Estado.

### "Puerto 8502 en uso"
Cambia `const PORT = 8502` en `server/index.ts` y el proxy en `vite.config.ts`.

### "Acceso denegado: path fuera del directorio del proyecto"
Las acciones de archivos (Python) solo operan dentro del directorio del **proyecto activo**. Verifica la ruta seleccionada en la barra lateral.

### Error de permisos al guardar `opencode.json`
Asegúrate de que la ruta de configuración sea escribible (`~/.config/opencode/opencode.json` en macOS/Linux, `%USERPROFILE%\.config\opencode\` en Windows) o usa el scope **Global** desde la app.

## ⚠️ Disclaimer para Windows

- Algunos comandos de OpenCode y el control de Docker requieren una **terminal con permisos** (PowerShell como administrador) y que las herramientas estén en el **PATH del sistema**.
- Si `opencode` no se detecta en el backend, reinicia la aplicación tras instalarlo (el PATH se lee al arrancar).
- En Windows, los cambios en `opencode.json` de scope **Global** se escriben en `%USERPROFILE%\.config\opencode\`; el scope **Proyecto** se escribe en la raíz del proyecto activo.
- Docker en Windows requiere **Docker Desktop** en ejecución (no solo el CLI).

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📝 Licencia

MIT. Ver archivo `LICENSE`.

## 🙏 Agradecimientos

- [Ollama](https://ollama.com/) · [OpenCode](https://opencode.ai/) · [sql.js](https://github.com/sql-js/sql.js) · [Docker](https://www.docker.com/) · [Lucide](https://lucide.dev/) · [Tailwind CSS](https://tailwindcss.com/)
