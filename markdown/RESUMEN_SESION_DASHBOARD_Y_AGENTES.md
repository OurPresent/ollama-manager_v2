# Resumen de sesión: Dashboard de consumo, switch de agentes y orquestación en Planes

Fecha: 2026-08-02
Rama: `main`
Commits: `8651627b` (funcionalidad nueva). Previos: `350f6e58` (sección Ollama unificada), `9007b977` (unificación SQLite).

## 1. Objetivo

Pedido del usuario sobre la sección **Inicio**:

1. Guía de uso actualizada.
2. Dashboard de consumo **real**: qué modelo consume más memoria y RAM total en uso.
3. Sección para elegir qué agentes participan en cada tarea (cada proyecto tiene funcionalidades distintas).

## 2. Decisiones de diseño (acordadas con el usuario)

- **Medición del consumo**: RAM en memoria (Ollama `/api/ps`) + uso histórico desde SQLite existente. No se creó ninguna tabla nueva.
- **Selección de agentes**: doble mecanismo:
  - Switch on/off por agente en la vista **Agentes** (persistido en `agents.is_active`).
  - Selector con checkboxes en **Planes**, con orquestación según funcionalidad (orden por rol + reorden manual).
- **Ubicación del dashboard**: solo en **Inicio**.

## 3. Backend

### `server/actions.py` — nueva acción Python `system_stats`

Devuelve `{ success, result: { total_ram, used_ram, free_ram, used_pct, ollama_ram } }` sin dependencias externas:

- **Windows**: `ctypes.GlobalMemoryStatusEx` + `tasklist /FI "IMAGENAME eq ollama.exe"` (parsing CSV).
- **Linux**: `/proc/meminfo` + suma de `VmRSS` de los procesos `ollama` en `/proc/*/status`.
- **macOS**: `sysctl hw.memsize` + `vm_stat` + `ps -axo rss,comm`.

Registrada en el dispatcher (`execute_action`) antes de las acciones docker/ollama.

### Servicios nuevos

- `server/services/systemStatsService.ts`: `getSystemStats()` → `SystemStats { totalRam, usedRam, freeRam, usedPct, ollamaRam }`.
- `server/services/modelUsageService.ts`: `getModelUsage()` → `ModelUsage[] { model, sessions, messages, agentRuns }` a partir de `chat_sessions.model_name`, JOIN con `chat_messages` y `agent_runs.model_name`; ordenado desc por uso total.

### Rutas nuevas

- `server/routes/systemRoutes.ts`: `GET /api/system/stats` y `GET /api/system/model-usage`. Montado en `server/index.ts` bajo `/api/system`.
- `server/routes/agentRoutes.ts`:
  - `GET /api/agents/all`: todos los agentes, activos e inactivos (el `GET /` original sigue devolviendo solo activos).
  - `PATCH /api/agents/:id/active` `{ active: boolean }` con evento de auditoría `agent.active.toggle`.
  - `mapAgentRow` ahora incluye `isActive`.
- `server/repositories/agentRepository.ts`: `listAllAgents()` y `setAgentActive(id, active)`.

## 4. Frontend

### Tipos y API

- `src/types/dto.ts`: `SystemStatsDto`, `ModelUsageDto`.
- `src/types/index.ts`: `PersistedAgent.isActive?: boolean`.
- `src/services/systemApi.ts`: `fetchAllAgents()`, `setAgentActive(id, active)`, `fetchSystemStats()`, `fetchModelUsage()`.

### `src/App.tsx`

Estado central `agents: PersistedAgent[]` cargado con `fetchAllAgents()` al montar; se inyecta por props a HomeView, AgentsView y PlanesView (y se actualiza al cambiar en AgentsView).

### `src/views/HomeView.tsx` (reescrito)

- Métricas: Modelos Instalados, Agentes Disponibles (`activos / total`), **RAM en uso** (bytes + %), Estado del Servidor.
- **Dashboard de Consumo Real**:
  - RAM total, libre, en uso (barra con umbrales de color: >85 % rojo, >60 % ámbar, resto verde) y RAM del proceso Ollama.
  - Panel "Consumo por Modelo en Memoria": modelos cargados (Ollama `/api/ps`) ordenados desc por tamaño, barras, VRAM/contexto y badge "▲ mayor consumo".
  - Panel "Uso Histórico por Modelo": sesiones/mensajes/corridas con barras y badge "▲ más utilizado".
- Polling cada 10 s (stats + uso + modelos en memoria) con flag `cancelled`.
- Guía Rápida de 8 pasos reescrita y 4 Acciones Rápidas.

### `src/views/AgentsView.tsx` (reescrito)

- Props controladas: `agents` + `onAgentsChange` (el estado vive en App).
- Switch on/off por agente (`Power`) → `setAgentActive` → refresh.
- Badge "Activo en pipeline" / "Desactivado (no se ejecuta en Planes)"; tarjeta con `opacity-60` si está inactivo.
- Stat "Activos" cuenta `a.isActive !== false` (los agentes previos sin flag se tratan como activos).

### `src/views/PlanesView.tsx`

- Prop `agents` (todos) y filtro `activeAgents`.
- `ROLE_PRIORITY`: PM → Backend → Frontend → DBA → QA → DevOps (rol desconocido = 999).
- Sección "Selección de Agentes del Pipeline": checkboxes por rol + lista de orden de orquestación con reorden ↑/↓ (`moveAgent`).
- `handleRunPipeline` valida que haya agentes activos y seleccionados antes de ejecutar; el loop itera en el orden elegido.

## 5. API resultante

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/system/stats` | RAM total/uso/libre/%, RAM del proceso Ollama |
| GET | `/api/system/model-usage` | Ranking de uso histórico por modelo |
| GET | `/api/agents` | Solo agentes activos |
| GET | `/api/agents/all` | Todos los agentes (con `isActive`) |
| PATCH | `/api/agents/:id/active` | Activar/desactivar agente |

## 6. Verificación

- `npx tsc --noEmit`: sin errores.
- `npx vite build`: OK (1823 módulos, ~2.9 s).
- Acción `system_stats` probada con Python real en Windows: `{ total_ram: 68.6 GB, used_pct: 35 % }`.
- Backend reiniciado (el dev server corre sin `--watch`) y endpoints probados en vivo:
  - `/api/system/stats` y `/api/system/model-usage` responden.
  - `GET /api/agents/all` devuelve los 6 agentes con `isActive: true`.
  - `PATCH /api/agents/:id/active` hizo toggle off/on correctamente (persistido).

## 7. Notas operativas

- El backend `pnpm dev:backend` **no usa `--watch`**: tras cambios de backend hay que reiniciarlo manualmente.
- `GET /api/agents` mantiene su contrato (solo activos); el pipeline y la UI usan el estado central de App.
- El dashboard de "mayor consumo" usa la lista ordenada desc por tamaño (no el primer elemento de la lista sin ordenar).
- README.md actualizado (características, tabla de acciones Python con `system_stats`, tablas SQLite reales, estructura del proyecto y guía de uso).
