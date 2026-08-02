# Plan de Implementación — LLMX v2

## 1. Commit del trabajo OpenCode
- `git add` de los archivos del feature OpenCode (8 nuevos + 8 modificados, incluye `server/memory.db`).
- Revisar `git log --oneline -10` para imitar el estilo y crear un commit único tipo
  `feat(opencode): integración headless con chat, sesiones, historial y configuración`.
- Sin push (solo commit).

## 2. Carga masiva JSON en Agentes (modelos + agentes)
**Backend**
- `schema.sql`: nueva tabla `models` (id, name UNIQUE, provider, size_bytes, digest, family, parameter_size, quantization_level, created_at, updated_at).
- Nuevo `server/repositories/modelRepository.ts` y `server/routes/modelsRoutes.ts` montado en `/api/models`:
  - `GET /` → catálogo persistido.
  - `POST /import` → validación de headers (requerido: `name`; opcionales: size/family/digest/…) con respuesta `{imported, updated, skipped, errors}`; dedupe por nombre.
  - `GET /template` → formato JSON apto (para mostrar en UI).
  - `DELETE /:id`.
- `agentRoutes.ts`: `POST /agents/import` con validación de headers (requeridos: name, role, systemPrompt) + respuesta tipo. `model` vacío por defecto → usa el **modelo global preseleccionado**.
- `db.ts`: helpers de export/replace de DB (reutilizados por respaldos).

**Frontend**
- `AgentsView.tsx`: card "Carga masiva (JSON)" con toggle **Modelos | Agentes**. Cada uno: formato apto (template `<pre>`), textarea + input de archivo `.json`, botones **Validar / Importar / Exportar** y lista de lo ya cargado. Respuesta visible inline.
- `systemApi.ts`: `importModels`, `fetchModels`, `importAgents`, `getImportTemplate`, etc. + tipos.
- `App.tsx` `refreshModels`: si Ollama está offline usa el catálogo `models` como fallback y preselecciona el global.

## 3. Auto-aprobaciones + notificación en pantalla
- `opencodeConfigService.ts`: `applyPermissions(scope, permission)` → merge del bloque `permission` en `opencode.json`.
- `opencodeRoutes.ts`: `POST /api/opencode/config/permissions` → `{scope, permission, autoMode}`. Si `autoMode` → `"*": "allow"`.
- `OpenCodeView.tsx` (tab Configuración): card **"Auto-aprobaciones"**:
  - Master toggle **"Modo auto"** + 4 filas con selector de 3 niveles **allow/ask/deny** (read, edit, bash, webfetch+websearch).
  - Botón **"Guardar auto-aprobaciones"** → notificación en pantalla (toast).
- Nuevo `src/components/Toast.tsx` + provider ligero montado en `App.tsx`; reutilizable.

## 4. Dispositivo + preparar entorno + respaldos (Configuración)
- Nuevo `server/services/deviceService.ts`:
  - `detectDeviceInfo()`: SO/plataforma/arch/hostname/RAM/CPU/user, **device_id** (UUID en `app_settings`, generado si es nuevo), versiones de node/pnpm/python/docker/git/opencode (por SO).
  - `prepareEnvironment()`: resolución de binarios por SO (`where` win32 / `which` posix), reporte persistido (`env_prepared`, `env_report`).
- Nuevo `server/routes/deviceRoutes.ts` (`/api/device`): `GET /info`, `POST /prepare`, `GET /backup` (base64 de la BD + manifest), `POST /restore` (reemplaza BD, re-ejecuta schema+migraciones).
- `SettingsView.tsx`: sección **"Dispositivo y Respaldos"**: info del dispositivo, **Preparar entorno**, **Exportar respaldo**, **Importar respaldo** con toast de completado.

## 5. README
- Nueva **"Guía de instalación por sistema operativo"**:
  1. **Instalar Docker (opcional)**: Windows (Docker Desktop + WSL2), macOS (Docker Desktop), Linux (apt/dnf/pacman).
  2. **Instalar Ollama local o imagen Docker**: Windows (instalador), macOS (brew/zip), Linux (curl), Docker (`docker run -d --name ollama -p 11434:11434 ollama/ollama`), nota WSL2.
  3. **Documentación oficial**: Docker Docs, Ollama Docs y OpenCode Docs (config, permissions, server).
- Disclaimer: app desarrollada sobre **Windows**; en otros SO puede tener defectos; sección "Cómo mejorar el soporte multi-SO".

## 6. Verificación
- `pnpm exec tsc --noEmit` y `pnpm exec vite build`.
- Pruebas CDP: import masivo (validar/importar/response + filas en DB), auto-aprobaciones (guardar → toast + bloque `permission`), respaldos (info, preparar, exportar/importar), render de Configuración.
- Limpieza de procesos de prueba.
