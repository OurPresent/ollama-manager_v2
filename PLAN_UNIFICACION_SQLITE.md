# Plan maestro de unificacion en SQLite

## Objetivo

Llevar el proyecto a una arquitectura donde `server/memory.db` sea la fuente unica de verdad para toda la informacion persistente del sistema.

Eso incluye como minimo:

- agentes,
- historial de chats,
- sesiones de chat,
- planes,
- ejecuciones de planes,
- mensajes de agentes,
- configuraciones,
- logs tecnicos,
- grafo de memoria,
- bitacoras,
- aprobaciones,
- contexto de proyecto,
- indice de archivos,
- auditoria de acciones.

## Decision principal

La mejor opcion para este proyecto es **centralizar todo lo persistente en SQLite** y dejar el frontend como cliente puro de la API.

### Regla de arquitectura

- `SQLite` = fuente oficial de verdad
- `Express` = capa de acceso y orquestacion
- `React` = presentacion y estado temporal de UI
- `localStorage` = eliminarlo para datos de negocio

Si en algun momento queremos cache visual para primer render, se puede evaluar despues, pero **la fuente oficial debe seguir siendo SQLite**.

---

## Principios de diseño

1. Una sola fuente de verdad: nada de duplicar memoria entre `localStorage` y SQLite.
2. Todo dato importante debe tener tabla propia o relacion clara.
3. Todo evento relevante debe ser auditable.
4. Toda vista del frontend debe leer y escribir por API.
5. Las rutas, sesiones y configuraciones no deben depender de placeholders del navegador.

---

## Problemas de la seccion 8 mejorados y convertidos en plan

## 1. Conflicto de puertos en desarrollo

### Problema actual

Frontend y backend intentan usar `8502`, lo que rompe `pnpm dev`.

### Mejor opcion

Separar frontend y backend con puertos fijos y predecibles:

- frontend Vite: `5173` o `8503`
- backend Express: `8502`

### Recomendacion concreta

La mejor opcion para este repo es:

- dejar **Express en `8502`**
- mover **Vite a `8503`**
- configurar proxy en Vite para `/api`

### Implementacion

1. Cambiar `vite.config.ts` para usar `8503`.
2. Agregar `server.proxy` apuntando a `http://localhost:8502`.
3. Reemplazar URLs hardcodeadas en frontend por rutas relativas `/api/...`.
4. Dejar una sola variable de entorno para Ollama y otra para backend si hace falta.

### Resultado esperado

- `pnpm dev` levanta sin colision
- el frontend deja de depender de puertos hardcodeados
- la app queda lista para evolucionar sin deuda basica de entorno

---

## 2. La ruta del proyecto no es una ruta real del sistema

### Problema actual

Hoy se guarda solo el nombre de carpeta, no una ruta absoluta util para Python.

### Mejor opcion

Registrar el proyecto desde backend y persistirlo en SQLite como entidad de primer nivel.

### Decision importante

La mejor opcion **no** es seguir confiando en `showDirectoryPicker()` para resolver rutas absolutas, porque el navegador limita ese acceso.

La mejor opcion es una de estas dos:

1. un selector/control desde backend o entorno local que devuelva una ruta real,
2. un input manual validado por backend para registrar la ruta del proyecto.

### Recomendacion concreta

Para este proyecto local, recomiendo:

- crear una tabla `projects`
- registrar `id`, `name`, `root_path`, `created_at`, `updated_at`, `is_active`
- validar existencia y permisos de la ruta desde backend

### Implementacion

1. Crear endpoint `POST /api/projects/register`.
2. Validar `root_path` en backend.
3. Crear endpoint `GET /api/projects/active`.
4. Reemplazar en el frontend el uso de `projectInfo.path` improvisado por el proyecto activo persistido.

### Resultado esperado

- Python siempre recibe una ruta real
- las acciones de archivos dejan de depender de nombres ambiguos
- el proyecto activo queda persistido y reutilizable

---

## 3. El contexto automatico del proyecto no esta realmente automatizado

### Problema actual

La app depende de un textarea manual y de memoria parcial.

### Mejor opcion

Construir un contexto de proyecto persistido y consultable desde SQLite, generado por procesos del backend.

### Recomendacion concreta

La mejor opcion es modelar el contexto en varias capas:

- `projects`
- `project_snapshots`
- `file_index`
- `graph_nodes`
- `task_logs`
- `project_context_blocks`

### Que deberia pasar

Cuando se activa o indexa un proyecto:

1. backend lista archivos,
2. clasifica tipos,
3. genera resumen estructural,
4. guarda indice y metadata en SQLite,
5. el chat consulta ese contexto por API.

### Implementacion

1. Crear tabla `file_index`.
2. Crear tabla `project_context_blocks`.
3. Crear proceso de indexacion inicial.
4. Reemplazar `projectContext` manual por contexto consultado desde backend.
5. Mantener un campo manual opcional solo como nota adicional del usuario, no como base del sistema.

### Resultado esperado

- contexto real del proyecto
- menos dependencia de texto pegado a mano
- mejor calidad de prompts y auditoria

---

## 4. Las referencias `$archivo` estan a medio implementar

### Problema actual

El parseo existe, pero la lectura real de archivos no esta cerrada.

### Mejor opcion

Resolver `$archivo` totalmente desde backend contra el proyecto registrado en SQLite.

### Recomendacion concreta

La mejor opcion es:

- el frontend solo detecta referencias,
- el backend resuelve la ruta relativa,
- lee el archivo,
- registra acceso en SQLite,
- devuelve contenido seguro al chat.

### Implementacion

1. Crear endpoint `POST /api/projects/:id/resolve-references`.
2. Usar `file_index` para autocompletar referencias.
3. Integrar de verdad `FileAutocomplete`.
4. Registrar lecturas en una tabla `file_access_log`.

### Tablas sugeridas

- `file_index`
- `file_access_log`
- `chat_message_file_refs`

### Resultado esperado

- referencias `$archivo` funcionales de verdad
- autocompletado consistente
- trazabilidad sobre que archivos alimentaron cada respuesta

---

## 5. Doble sistema de memoria: `localStorage` y SQLite

### Problema actual

Hay dos persistencias paralelas y compiten entre si.

### Mejor opcion

Eliminar `localStorage` para datos del dominio y migrar todo a API + SQLite.

### Recomendacion concreta

La mejor opcion es una migracion controlada:

1. declarar SQLite como fuente oficial,
2. mover lectura de `HistoryView`, `ChatView`, `PlanesView`, `AgentsView` y `SettingsView` a backend,
3. dejar `localStorage` solo temporalmente como fallback de migracion,
4. removerlo del codigo una vez terminada la transicion.

### Implementacion

1. Crear repositorio backend por modulo.
2. Crear endpoints de lectura/escritura consistentes.
3. Reescribir `src/services/memoryDb.ts` para consumir API o reemplazarlo por `sqliteApi.ts`.
4. Migrar datos antiguos si hace falta.

### Resultado esperado

- coherencia de datos
- historial real compartido por todas las vistas
- menos bugs de sincronizacion

---

## 6. Las consultas del chat se guardan en backend, pero no son la fuente mostrada en historial

### Problema actual

El chat persiste una parte en backend, pero la UI sigue leyendo otra fuente.

### Mejor opcion

Modelar chat como una entidad completa en SQLite y hacer que toda la UI lea desde ahi.

### Recomendacion concreta

La mejor opcion es separar:

- sesiones de chat,
- mensajes,
- metadata del prompt,
- archivos referenciados,
- acciones ejecutadas,
- respuesta final,
- errores.

### Tablas sugeridas

- `chat_sessions`
- `chat_messages`
- `chat_message_context`
- `chat_message_file_refs`
- `chat_actions`
- `chat_action_results`

### Implementacion

1. Crear `chat_sessions`.
2. Crear `chat_messages` con `role`, `content`, `status`, `created_at`.
3. Asociar mensajes a proyecto, modelo y sesion.
4. Hacer que `HistoryView` consulte historial real de chats.
5. Permitir reabrir sesiones desde UI.

### Resultado esperado

- historial de chat real
- trazabilidad por sesion
- base fuerte para analitica, auditoria y memoria

---

## 7. El sistema de aprobaciones existe, pero no dispara aprobaciones reales

### Problema actual

La UI existe, pero no hay flujo real de aprobacion persistente.

### Mejor opcion

Persistir aprobaciones en SQLite y tratarlas como parte del flujo de ejecucion.

### Recomendacion concreta

Toda accion sensible deberia generar una solicitud formal si corresponde:

- escritura de archivos criticos,
- borrado,
- decisiones de arquitectura,
- cambios de configuracion,
- ejecucion de planes automatizados.

### Tablas sugeridas

- `approval_requests`
- `approval_decisions`
- `approval_targets`

### Implementacion

1. Integrar `requestApproval()` con endpoints reales.
2. Guardar solicitud, estado, riesgo y entidad afectada en SQLite.
3. Bloquear la ejecucion hasta recibir decision.
4. Registrar decision y usuario/actor.

### Resultado esperado

- aprobaciones auditables
- flujo robusto para automatizaciones
- base lista para multiagente serio

---

## 8. `AgentsView` no ejecuta agentes de verdad

### Problema actual

La vista administra fichas de agentes, pero no entidades vivas ni ejecuciones persistidas.

### Mejor opcion

Convertir agentes en entidades reales del dominio con definicion, versionado y ejecuciones registradas en SQLite.

### Recomendacion concreta

La mejor opcion es separar claramente:

- definicion del agente,
- version de prompt,
- corrida de agente,
- mensajes del agente,
- artefactos generados.

### Tablas sugeridas

- `agents`
- `agent_versions`
- `agent_runs`
- `agent_run_messages`
- `agent_artifacts`

### Implementacion

1. Persistir agentes desde `AgentsView`.
2. Crear endpoint para ejecutar un agente concreto.
3. Hacer que `PlanesView` reutilice agentes persistidos en vez de hardcodearlos.
4. Registrar cada salida y accion del agente.

### Resultado esperado

- agentes reales y reutilizables
- pipeline configurable
- base para observabilidad y comparacion de resultados

---

## 9. Configuracion de Ollama cargada una sola vez

### Problema actual

La configuracion se lee al cargar el modulo y puede quedar desactualizada.

### Mejor opcion

Persistir configuracion en SQLite y cargarla desde backend cada vez que haga falta o mediante cache controlada en frontend.

### Recomendacion concreta

La mejor opcion es tener una tabla de configuracion general y otra opcional por proyecto.

### Tablas sugeridas

- `app_settings`
- `project_settings`

### Implementacion

1. Crear servicio backend de settings.
2. Reemplazar lectura directa desde `localStorage`.
3. Hacer que `ollama.ts` consulte configuracion actual o la reciba desde un store hidratado por API.
4. Registrar cambios de configuracion en log de auditoria.

### Resultado esperado

- configuracion consistente
- cambios reflejados sin estados fantasmas
- historial de cambios disponible

---

## La arquitectura objetivo que recomiendo

## Fuente unica de verdad

Todo dato persistente debe quedar en `memory.db`.

## Distribucion de responsabilidades

### Frontend

- renderiza
- solicita datos
- mantiene solo estado efimero de pantalla

### Backend

- aplica reglas de negocio
- ejecuta indexacion
- controla accesos a archivos
- persiste sesiones, agentes, configuraciones y eventos

### SQLite

- persiste el estado historico y operativo completo del sistema

---

## Esquema de datos recomendado

## Nucleo del sistema

- `projects`
- `project_settings`
- `app_settings`
- `system_logs`
- `audit_events`

## Memoria y conocimiento

- `graph_nodes`
- `graph_edges` (recomendado agregar)
- `task_logs`
- `project_context_blocks`
- `project_snapshots`

## Archivos

- `file_index`
- `file_access_log`
- `file_action_runs`

## Chat

- `chat_sessions`
- `chat_messages`
- `chat_message_context`
- `chat_message_file_refs`
- `chat_actions`
- `chat_action_results`

## Agentes

- `agents`
- `agent_versions`
- `agent_runs`
- `agent_run_messages`
- `agent_artifacts`

## Planes

- `plans`
- `plan_steps`
- `plan_runs`
- `plan_run_steps`
- `plan_run_links_agents`

## Aprobaciones

- `approval_requests`
- `approval_decisions`
- `approval_targets`

## Modelos y ejecucion

- `ollama_models_cache`
- `execution_contexts`

---

## Orden de implementacion recomendado

## Fase 1. Estabilizacion base

1. resolver puertos
2. mover frontend a rutas `/api`
3. centralizar configuracion base

## Fase 2. SQLite como fuente oficial

1. crear nuevas tablas nucleares
2. migrar settings
3. migrar historial y memoria
4. apagar dependencias en `localStorage`

## Fase 3. Proyecto real y archivos

1. crear `projects`
2. registrar ruta real
3. indexar archivos
4. resolver `$archivo`

## Fase 4. Chat persistente serio

1. sesiones
2. mensajes
3. archivos referenciados
4. acciones ejecutadas
5. vista de historial real

## Fase 5. Agentes y planes persistidos

1. persistir agentes
2. persistir planes
3. persistir corridas
4. reutilizar agentes en pipeline

## Fase 6. Aprobaciones y auditoria

1. persistir aprobaciones
2. persistir logs de acciones
3. registrar eventos del sistema

---

## Que eliminaria o refactorizaria

### Eliminar

- uso de `localStorage` para memoria del dominio
- rutas hardcodeadas de backend
- dependencia del nombre de carpeta como si fuera ruta real

### Refactorizar

- `src/services/memoryDb.ts`
- `src/services/ollama.ts`
- `src/views/ChatView.tsx`
- `src/views/HistoryView.tsx`
- `src/views/AgentsView.tsx`
- `src/views/PlanesView.tsx`
- `src/views/SettingsView.tsx`
- `server/schema.sql`
- `server/index.ts`

---

## Mi recomendacion final

Si quieres la mejor base posible para este producto, yo tomaria esta decision sin medias tintas:

**todo lo persistente del sistema debe vivir en `memory.db`, y el frontend no debe guardar estado de negocio en `localStorage`.**

Eso te da:

- consistencia,
- trazabilidad,
- mejor depuracion,
- mejor evolucion a multiagente,
- historial real,
- auditoria real,
- configuracion confiable,
- menos deuda tecnica.

## Siguiente paso recomendado

El mejor siguiente paso es hacer un **rediseño del esquema SQLite** y una **fase 1 de migracion** antes de seguir agregando nuevas funciones.

Ese seria el orden correcto:

1. definir tablas nuevas,
2. estabilizar backend,
3. migrar frontend a API,
4. despues ampliar agentes, planes, memoria y auditoria.

---

## Estado de implementacion (agosto 2026)

Completado:

- [x] Backend modular: repositorios + routers Express en `server/` (settings, projects, agents, graph, queries, logs, actions, docker, ollama, chat, audit), puerto `8502`, montados en `server/index.ts`.
- [x] `actions.py` corregido (path-traversal con `os.path.commonpath`) y mode-aware para Ollama (docker/local) con helpers HTTP (`ollama_api_request`, `ollama_list_models`, `ollama_running_models`, `ollama_load_model`, `ollama_stop_model`).
- [x] Servicio y rutas de modelos en memoria (`/api/ollama/models`, `/running`, `/models/load`, `/models/stop`) via `server/services/ollamaService.ts`.
- [x] Tipado del frontend: `src/types/dto.ts`, stores zustand, `apiDb.ts`/`systemApi.ts` sin `any`; eliminado el hack `window.__approvalResolve` (aprobaciones con resolvers internos + suscripcion).
- [x] Chat persistido en SQLite: `chat_sessions` + `chat_messages`, `src/services/chatDb.ts`, `src/store/chatStore.ts`, `ChatView` reescrito y `Sidebar` con Conversaciones.
- [x] `HistoryView` desde BD: tabs Nodos / Bitacoras / Consultas / Auditoria.
- [x] `PlanesView` sin agentes hardcodeados: carga los 6 agentes semilla desde la BD (prompts con instrucciones `<action>`); cada salida de agente persiste en `task_logs` y sincroniza el grafo.
- [x] Indice de archivos: `server/services/fileIndexService.ts` + endpoints `POST /:id/index`, `GET /:id/files?q=`, `GET /:id/files/content` (con proteccion de path traversal) + `file_access_log`.
- [x] `FileAutocomplete` conectado en `ChatView` (controlado, lista real desde el indice, boton de reindexado) y referencias `$archivo` resueltas con contenido real del backend.
- [x] Settings sin hardcode de puerto (usa `getBackendUrl()`) y tema sincronizado con `localStorage` + script anti-FOUC en `index.html`.
- [x] Endpoints de auditoria: `/api/audit/events`, `/api/audit/logs`, `/api/audit/file-access`.
- [x] Panel "Modelos en Memoria" en `OllamaView` (listar/cargar/descargar con polling).
- [x] Verificacion: `npx tsc --noEmit` limpio y `npx vite build` exitoso.

Pendiente a futuro:

- [ ] Persistir `plans`, `plan_runs` y `agent_runs` como tablas de ejecucion (hoy el pipeline persiste salidas en `task_logs` y grafo).
- [ ] Tablas `project_snapshots`, `project_context_blocks` y generacion automatica de contexto estructural.
- [ ] Persistir aprobaciones en `approval_requests`/`approval_decisions` y disparar `requestApproval()` desde acciones sensibles.
- [ ] Versionado de prompts de agentes (`agent_versions`, `agent_runs`).
- [ ] Endpoint de resolucion de referencias batch (`resolve-references`).
