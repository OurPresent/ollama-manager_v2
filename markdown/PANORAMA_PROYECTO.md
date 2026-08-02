# Panorama del proyecto `ollama-manager_v2`

## 1. Que entendi del proyecto

Este proyecto busca ser un centro de control local para trabajar con Ollama y flujos asistidos por IA desde una interfaz web. La idea central es reunir en una sola app:

- gestion de modelos locales de Ollama,
- chat contextual sobre un proyecto activo,
- un pipeline de agentes por roles,
- ejecucion de acciones reales sobre archivos mediante Python,
- memoria persistente del proyecto.

En la practica, hoy el proyecto ya tiene una base funcional interesante, pero mezcla partes completamente operativas con otras que todavia son mas "vision de producto" que flujo terminado de punta a punta.

## 2. Stack y arquitectura general

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

Carpeta principal: `src/`

### Backend

- Express
- TypeScript
- `sql.js` para persistencia SQLite local

Carpeta principal: `server/`

### Integracion de sistema

- Script Python `server/actions.py`
- Ejecuta acciones sobre archivos del proyecto
- Tambien controla Docker/Ollama

## 3. Como esta organizado el frontend

La app principal vive en `src/App.tsx` y maneja estas vistas:

- `home`: dashboard general
- `chat`: chat contextual del proyecto
- `agents`: gestor visual de agentes
- `planes`: generacion y ejecucion de planes por pipeline
- `ollama`: descarga y borrado de modelos
- `playground`: pruebas de prompts
- `history`: memoria persistente visible en UI
- `settings`: tema, endpoints y estado de servicios

El `Sidebar` concentra la navegacion, el proyecto activo, el modelo seleccionado y un control rapido para iniciar/detener Ollama.

## 4. Que hace cada modulo importante

### Chat del proyecto

`src/views/ChatView.tsx`

Hace streaming contra `POST /api/chat` de Ollama y construye un prompt del sistema con:

- nombre/ruta del proyecto,
- memoria local del grafo,
- ultima bitacora guardada,
- un bloque manual de "contexto de codigo",
- referencias tipo `$archivo`.

Ademas, si el modelo devuelve bloques `<action>...</action>`, el frontend intenta ejecutarlos contra el backend para que Python modifique archivos reales.

### Pipeline de planes

`src/views/PlanesView.tsx`

Permite:

1. generar un plan tecnico con IA,
2. ejecutar una secuencia de roles simulados,
3. permitir que cada rol emita acciones de archivos,
4. cerrar con una auditoria que puede actualizar memoria.

Es un pipeline secuencial orientado a "Project Manager -> Backend -> Frontend -> DBA -> QA -> DevOps -> Auditoria".

### Gestor de agentes

`src/views/AgentsView.tsx`

Hoy funciona principalmente como interfaz de administracion local de tarjetas de agentes:

- crear,
- editar,
- borrar,
- ver prompt y estado.

No encontre una ejecucion real conectada a backend o a Ollama desde esta vista. Es mas bien un editor/catalogo visual de agentes.

### Gestor de Ollama

`src/views/OllamaView.tsx`

Permite:

- descargar modelos con streaming de progreso,
- listar modelos instalados,
- borrar modelos.

Usa directamente la API HTTP de Ollama.

### Playground

`src/views/PlaygroundView.tsx`

Es una interfaz simple para probar prompts, `system prompt`, `user prompt` y temperatura contra Ollama.

### History / memoria

`src/views/HistoryView.tsx`

Muestra:

- nodos del grafo,
- bitacoras markdown.

Pero esta vista consume memoria desde `localStorage`, no desde SQLite.

### Settings

`src/views/SettingsView.tsx`

Maneja:

- tema oscuro/claro/sistema,
- URL de Ollama,
- modo local/docker,
- estado de Ollama,
- estado de Docker,
- controles para iniciar/detener/reiniciar.

## 5. Backend y persistencia

### Servidor Express

`server/index.ts`

Expone endpoints para:

- grafo de memoria,
- logs/bitacoras,
- consultas SQL guardadas,
- ejecucion de acciones via Python,
- control Docker/Ollama via Python.

### Base de datos

`server/db.ts` y `server/schema.sql`

La base `memory.db` guarda:

- `graph_nodes`
- `project_queries`
- `task_logs`

### Script Python

`server/actions.py`

Implementa dos grupos de acciones:

- archivos: leer, escribir, borrar, listar, crear directorios, etc.
- Docker/Ollama: status, start, stop, restart, info

Tiene una validacion de seguridad para impedir path traversal fuera del proyecto.

## 6. Flujo de datos que veo hoy

### Flujo ideal planteado por el proyecto

1. eliges un proyecto activo,
2. eliges un modelo local,
3. consultas o defines un objetivo,
4. el modelo responde,
5. si devuelve acciones, Python las ejecuta,
6. se guarda memoria del proyecto,
7. puedes revisar historial y grafo.

### Flujo real actual

Ese flujo existe parcialmente, pero con varias desconexiones:

- el chat usa memoria de `localStorage`,
- el backend tambien tiene SQLite para memoria,
- pero la UI no esta realmente sincronizada con esa SQLite,
- algunas funciones prometen "contexto automatico del proyecto", aunque hoy dependen mucho de texto manual o placeholders.

## 7. Lo que si parece ya funcional

- UI principal y navegacion general
- deteccion de modelos de Ollama
- streaming de chat contra Ollama
- descarga y borrado de modelos
- playground de prompts
- endpoints backend para SQLite
- script Python para archivos y Docker
- generacion de planes y pipeline secuencial a nivel de UX
- persistencia local basica del grafo/bitacoras en `localStorage`

## 8. Lo que veo parcial, incompleto o desalineado

### 1. Conflicto de puertos en desarrollo

El problema mas serio hoy:

- Vite esta configurado en `8502`
- Express tambien escucha en `8502`
- `pnpm dev` falla por `EADDRINUSE`

En la prueba real, Vite intenta moverse a `8503`, mientras el backend termina fallando al levantar. Eso deja el entorno de desarrollo desalineado.

### 2. La ruta del proyecto no parece ser una ruta real del sistema

En `Sidebar.tsx`, cuando se selecciona una carpeta, se guarda solo:

- `dirHandle.name`, o
- el nombre de la carpeta detectada

Eso no es una ruta absoluta del sistema. Como `actions.py` espera un `project_path` real para operar archivos, las acciones de Python probablemente fallen o solo funcionen en casos muy concretos.

### 3. El "contexto automatico del proyecto" no esta realmente automatizado

La app comunica que inyecta contexto del proyecto, pero en codigo real veo que depende de:

- un `textarea` manual (`projectContext`),
- nodos y bitacoras en `localStorage`,
- referencias `$archivo` que no siempre cargan contenido real.

No encontre un indexado real del repo ni lectura completa automatica del proyecto.

### 4. Las referencias `$archivo` estan a medio implementar

`fileReference.ts` detecta referencias como `$miArchivo.ts`, pero:

- no conserva un acceso real a los archivos del sistema,
- en varios casos devuelve texto placeholder,
- no vi integracion real del componente `FileAutocomplete`.

O sea: la idea existe, pero la lectura real de archivos desde navegador no esta cerrada.

### 5. Doble sistema de memoria: `localStorage` y SQLite

Hay dos capas paralelas:

- `src/services/memoryDb.ts` usa `localStorage`
- `server/index.ts` + SQLite guardan grafo/logs/querys

Pero la UI de historial consume `localStorage`, mientras el backend expone SQLite. Eso sugiere una arquitectura a medio migrar o una integracion aun incompleta.

### 6. Las consultas del chat se guardan en backend, pero no son la fuente mostrada en historial

`ChatView` llama `saveQueryLog`, que persiste via API en backend. Sin embargo, `HistoryView` no consulta esos endpoints; lee solo `localStorage`. Entonces hay persistencia en backend que la UI no refleja directamente.

### 7. El sistema de aprobaciones existe, pero no vi que dispare aprobaciones reales

`approvalSystem.ts` esta armado y `ChatView` monta la interfaz para aprobaciones pendientes, pero no encontre una llamada real a `requestApproval()` dentro del flujo normal. Parece preparado para una futura capa de confirmaciones.

### 8. `AgentsView` no ejecuta agentes de verdad

La vista esta bien como administrador visual, pero hoy no orquesta ejecuciones reales. El pipeline real esta mas cerca de `PlanesView`.

### 9. Configuracion de Ollama cargada una sola vez

En `src/services/ollama.ts`, la URL base de Ollama se resuelve al cargar el modulo. Si cambias configuracion en `Settings`, es posible que algunas funciones no tomen la nueva URL hasta recargar la app.

## 9. Mi lectura del estado del proyecto

Yo lo veo como un proyecto con buena direccion de producto y una base tecnica ya util, especialmente para:

- experimentar localmente con Ollama,
- hacer chat asistido,
- probar prompts,
- explorar la idea de agentes y memoria persistente,
- ejecutar acciones de sistema por Python.

Pero todavia no lo veo como una plataforma completamente cerrada o consistente de punta a punta. Hay varias piezas que ya venden una experiencia avanzada, aunque internamente siguen siendo un primer ensamblaje.

En resumen:

- la vision esta clara,
- el frontend esta bastante armado,
- el backend existe y ya resuelve cosas utiles,
- la integracion entre navegador, archivos reales, memoria y backend todavia necesita consolidacion.

## 10. Que asumo para futuras tareas

Si me pides cambios sobre este proyecto, mi marco mental va a ser este:

- es una app local para orquestar trabajo con Ollama,
- el nucleo actual vive en React + Express + Python,
- hay funcionalidades reales y otras aspiracionales mezcladas,
- conviene priorizar consistencia tecnica antes de agregar mas capas,
- cualquier trabajo sobre chat, memoria, archivos o agentes deberia revisar primero si la fuente de verdad sera `localStorage`, SQLite o ambas.

## 11. Prioridades tecnicas que yo atenderia primero

Si el objetivo es estabilizar el proyecto, mis primeras prioridades serian:

1. resolver el conflicto de puertos entre frontend y backend,
2. definir una sola fuente de verdad para memoria e historial,
3. arreglar la seleccion de proyecto para obtener una ruta util de verdad,
4. decidir si las referencias `$archivo` van a funcionar con acceso real o solo como ayuda visual,
5. conectar de verdad la ejecucion de agentes o simplificar la UI para reflejar mejor el estado actual.

## 12. Archivo creado para referencia

Este documento fue creado para usarlo como mapa base del proyecto cuando sigamos trabajando sobre el repo.
