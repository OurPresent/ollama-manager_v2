# Plan de Implementación — LLMX v2

## 1. Commit del trabajo OpenCode
- `git add` de los archivos del feature OpenCode (8 nuevos + 8 modificados, incluye `server/memory.db`).
- Revisar `git log --oneline -10` para imitar el estilo y crear un commit único tipo
  `feat(opencode): integración headless con chat, sesiones, historial y configuración`.
- Sin push (solo commit).

## 2. Skills + Carga masiva JSON en Agentes (skills + agentes)
> Pivot: se **elimina el catálogo de modelos persistido** (`models`); en su lugar se gestionan **skills** en formato `SKILL.md` (como otros IDEs). Ollama ya carga los modelos en vivo.

**Backend**
- `schema.sql`: la tabla `models` se **reemplaza** por `skills` (id, name UNIQUE, description, content, references_json DEFAULT '[]', scope 'project'|'global', is_active, created_at, updated_at) + índices.
- Nuevo `server/repositories/skillRepository.ts`: `listSkills`/`getSkillByName`/`upsertSkill` (dedupe por nombre, `createId('skill')`)/`setSkillActive`/`setSkillScope`/`deleteSkill`/`normalizeSkillItem` (requeridos `name` slug + `content`; opcionales description/references/scope/enabled)/`importSkills`/`exportSkills`.
- Nuevo `server/services/skillInstaller.ts`: escribe `SKILL.md` (+ archivos de `references`) en `.opencode/skills/<name>` del proyecto activo o `~/.agents/skills/<name>` (global); `listInstalledOnDisk`, `uninstallSkillFromDisk`.
- Nuevo `server/routes/skillsRoutes.ts` montado en `/api/skills`: `GET /` (skills + flags installedProject/installedGlobal), `GET /installed`, `GET /template`, `POST /validate`, `POST /import` (persiste + instala en disco), `GET /export`, `POST /:id/toggle`, `POST /:id/install`, `POST /:id/uninstall`, `DELETE /:id`.
- Se **eliminan** `server/repositories/modelRepository.ts` y `server/routes/modelsRoutes.ts` (y sus imports en `server/index.ts`).
- `agentRoutes.ts`: `POST /agents/import` con validación de headers (requeridos: name, role, systemPrompt) + respuesta tipo. `model` vacío por defecto → usa el **modelo global preseleccionado**.

**Frontend**
- `AgentsView.tsx`: card "Carga masiva (JSON)" con toggle **Skills | Agentes**. Cada uno: formato apto (template `<pre>`), textarea + input de archivo `.json`, botones **Validar / Importar / Exportar**. Modal **"Skills instalados"** con instalar (proyecto/global), activar/desactivar, desinstalar y eliminar.
- `systemApi.ts`: se quitan `fetchModels`/`importModelsBulk`/`validateModelsBulk`/`exportModelsBulk`/`deleteModel`/`fetchModelsTemplate`. Nuevo `src/services/skills.ts` (clientes REST de skills). Tipos: se elimina `PersistedModel`, se añade `PersistedSkill`/`InstalledSkill`.
- `App.tsx` `refreshModels`: **se elimina el fallback** al catálogo `models`; sin Ollama → lista vacía.

## 3. Sección Integraciones (ecosistema local)
- Nuevo `server/services/integrationsService.ts`: catálogo de 10 integraciones (Supabase local, Firebase Emulators, PostgreSQL, MySQL/MariaDB, MongoDB, Redis, Docker, Puppeteer/Playwright, Ollama, OpenCode) con detección local (CLI vía `where`/`which`, paquete npm en `node_modules`, Docker) y guías de configuración con pasos + variables de entorno + docs.
- Nuevo `server/routes/integrationsRoutes.ts` montado en `/api/integrations`: `GET /` (catálogo + resumen detected/total/categorías), `GET /:id`, `GET /:id/guide` (markdown), `POST /:id/detect`.
- Frontend: `src/services/integrations.ts`, `src/views/IntegracionesView.tsx` (cards con estado detectado, ver guía en modal, copiar variables `.env`, re-detectar), entrada `integraciones` en `Sidebar.tsx` y ruta en `App.tsx`.

## 4. Auto-aprobaciones + notificación en pantalla- `opencodeConfigService.ts`: `applyPermissions(scope, permission)` → merge del bloque `permission` en `opencode.json`.
- `opencodeRoutes.ts`: `POST /api/opencode/config/permissions` → `{scope, permission, autoMode}`. Si `autoMode` → `"*": "allow"`.
- `OpenCodeView.tsx` (tab Configuración): card **"Auto-aprobaciones"**:
  - Master toggle **"Modo auto"** + 4 filas con selector de 3 niveles **allow/ask/deny** (read, edit, bash, webfetch+websearch).
  - Botón **"Guardar auto-aprobaciones"** → notificación en pantalla (toast).
- Nuevo `src/components/Toast.tsx` + provider ligero montado en `App.tsx`; reutilizable.

## 5. Dispositivo + preparar entorno + respaldos (Configuración)
- Nuevo `server/services/deviceService.ts`:
  - `detectDeviceInfo()`: SO/plataforma/arch/hostname/RAM/CPU/user, **device_id** (UUID en `app_settings`, generado si es nuevo), versiones de node/pnpm/python/docker/git/opencode (por SO).
  - `prepareEnvironment()`: resolución de binarios por SO (`where` win32 / `which` posix), reporte persistido (`env_prepared`, `env_report`).
- Nuevo `server/routes/deviceRoutes.ts` (`/api/device`): `GET /info`, `POST /prepare`, `GET /backup` (base64 de la BD + manifest), `POST /restore` (reemplaza BD, re-ejecuta schema+migraciones).
- `SettingsView.tsx`: sección **"Dispositivo y Respaldos"**: info del dispositivo, **Preparar entorno**, **Exportar respaldo**, **Importar respaldo** con toast de completado.

## 6. README
- Nueva **"Guía de instalación por sistema operativo"**:
  1. **Instalar Docker (opcional)**: Windows (Docker Desktop + WSL2), macOS (Docker Desktop), Linux (apt/dnf/pacman).
  2. **Instalar Ollama local o imagen Docker**: Windows (instalador), macOS (brew/zip), Linux (curl), Docker (`docker run -d --name ollama -p 11434:11434 ollama/ollama`), nota WSL2.
  3. **Documentación oficial**: Docker Docs, Ollama Docs y OpenCode Docs (config, permissions, server).
- Disclaimer: app desarrollada sobre **Windows**; en otros SO puede tener defectos; sección "Cómo mejorar el soporte multi-SO".

## 7. Verificación
- `pnpm exec tsc --noEmit` y `pnpm exec vite build`.
- Pruebas CDP: import de skills (validar/importar/instalar en disco/listar/toggle/uninstall/delete), integraciones (catálogo, detección, guía, re-detectar), import masivo de agentes, auto-aprobaciones (guardar → toast + bloque `permission`), respaldos (info, preparar, exportar/importar), render de Configuración.
- Limpieza de procesos de prueba.
