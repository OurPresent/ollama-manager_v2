# 🚀 LLMX v2 - Control Center Local

**Orquestación local de Modelos, Agentes y Grafos de Memoria**

LLMX v2 es una aplicación web completa para gestionar modelos de lenguaje locales (Ollama), ejecutar pipelines de agentes especializados y mantener un grafo de conocimiento persistente de tus proyectos.

## ✨ Características

- **🤖 Chat con Memoria Contextual**: Consulta tu código con IA que inyecta automáticamente el contexto del proyecto (bitácoras, entidades, componentes)
- **🔗 Pipeline de Agentes**: Ejecuta flujos de trabajo automáticos con agentes especializados (PM, Backend, Frontend, QA, DevOps)
- **📦 Gestor Ollama**: Descarga, elimina y gestiona modelos LLM locales directamente desde la interfaz
- **🧪 Playground**: Prueba modelos con parámetros personalizados (temperature, top_p, etc.)
- **📊 Historial Completo**: Revisa todas las consultas, agentes ejecutados y cambios en el grafo de conocimiento
- **💾 Memoria Persistente**: Base de datos SQLite local que evoluciona con cada interacción

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    LLMX v2 Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Frontend   │      │   Backend    │      │  Ollama   │ │
│  │   (Vite)     │◄────►│  (Express)   │◄────►│  Server   │ │
│  │   Port 8502  │      │   Port 8502  │      │ Port 11434│ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                       │                          │
│         │                       │                          │
│  ┌──────┴────────┐      ┌──────┴────────┐                 │
│  │  React + TS   │      │  SQLite DB    │                 │
│  │  Tailwind CSS │      │  (sql.js)     │                 │
│  │  Lucide Icons │      │  memory.db    │                 │
│  └───────────────┘      └───────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Requisitos Previos

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (o npm/yarn)
- **Ollama** instalado y corriendo en http://localhost:11434
- **Python 3.8+** (para compilar better-sqlite3 si es necesario)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/ollama-manager-v2.git
cd ollama-manager-v2
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
| `pnpm build` | Compila el proyecto para producción |
| `pnpm preview` | Previsualiza la build de producción |

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
└── schema.sql         # Esquema de la base de datos
```

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript 5** - Tipado estático
- **Vite 5** - Build tool y dev server
- **Tailwind CSS 3** - Estilos utility-first
- **Lucide React** - Iconos

### Backend
- **Express 4** - Servidor web
- **SQLite (sql.js)** - Base de datos
- **CORS** - Manejo de cross-origin requests
- **TSX** - Ejecución de TypeScript en Node.js

### DevOps
- **Concurrently** - Ejecución paralela de scripts
- **pnpm** - Gestor de paquetes

## 📁 Estructura del Proyecto

```
ollama-manager-v2/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Sidebar.tsx
│   │   └── MetricCard.tsx
│   ├── services/            # Lógica de negocio
│   │   ├── ollama.ts        # Cliente de Ollama
│   │   ├── memoryDb.ts      # Base de datos local (localStorage)
│   │   └── apiDb.ts         # Cliente del backend
│   ├── types/               # Tipos TypeScript
│   │   └── index.ts
│   ├── views/               # Vistas principales
│   │   ├── HomeView.tsx
│   │   ├── ChatView.tsx
│   │   ├── AgentsView.tsx
│   │   ├── OllamaView.tsx
│   │   ├── PlaygroundView.tsx
│   │   └── HistoryView.tsx
│   ├── App.tsx              # Componente principal
│   ├── main.tsx             # Entry point
│   └── index.css            # Estilos globales
├── server/
│   ├── index.ts             # Servidor Express
│   ├── db.ts                # Conexión SQLite
│   ├── types.d.ts           # Tipos para sql.js
│   └── schema.sql           # Esquema de base de datos
├── public/
│   └── vite.svg             # Favicon
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🎯 Guía de Uso

### 1. Chat del Proyecto
- Selecciona un modelo de la lista
- Escribe tu consulta sobre el código
- El sistema inyecta automáticamente el contexto del proyecto

### 2. Pipeline de Agentes
- Ejecuta agentes especializados en secuencia
- Cada agente procesa el proyecto con un rol específico
- Los resultados se guardan en el grafo de conocimiento

### 3. Gestor Ollama
- Descarga nuevos modelos desde Ollama Hub
- Elimina modelos que no necesites
- Visualiza el tamaño y fecha de cada modelo

### 4. Playground
- Ajusta parámetros: temperature, top_p, max_tokens
- Compara respuestas de diferentes modelos
- Experimenta con configuraciones

### 5. Historial
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

## 🐛 Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"
La aplicación usa `sql.js` en lugar de `better-sqlite3` para evitar compilación nativa. Si tienes problemas, ejecuta:
```bash
pnpm install
```

### Error: "Ollama no está disponible"
1. Verifica que Ollama esté instalado: `ollama --version`
2. Inicia el servidor: `ollama serve`
3. Verifica que esté en http://localhost:11434

### Error: "Puerto 8502 en uso"
Cambia el puerto en `vite.config.ts` y `server/index.ts`

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

---

**⭐ Si te gusta este proyecto, dale una estrella en GitHub**