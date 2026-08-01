import React, { useState, useEffect } from 'react';
import { ActiveView, OllamaModel, ProjectInfo } from '../types';
import { 
  Home, 
  MessageSquare, 
  Bot, 
  Box, 
  Sliders, 
  History, 
  Folder, 
  Cpu,
  Circle,
  Play,
  Square,
  Loader2,
  Settings
} from 'lucide-react';
import { checkDockerOllamaStatus, startOllamaDocker, stopOllamaDocker, DockerStatus } from '../services/dockerControl';
import { activateProject, fetchActiveProject, fetchProjects, registerProject } from '../services/systemApi';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isOllamaOnline: boolean;
  models: OllamaModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  projectInfo: ProjectInfo;
  setProjectInfo: (info: ProjectInfo) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOllamaOnline,
  models,
  selectedModel,
  setSelectedModel,
  projectInfo,
  setProjectInfo,
}) => {
  const [dockerStatus, setDockerStatus] = useState<DockerStatus>({ running: false, details: '' });
  const [isControlling, setIsControlling] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectInfo[]>([]);
  const [projectPathInput, setProjectPathInput] = useState(projectInfo.path);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [projectMessage, setProjectMessage] = useState('');

  const menuItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat del Proyecto', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'agents', label: 'Agentes', icon: <Bot className="w-4 h-4" /> },
    { id: 'planes', label: 'Planes', icon: <Play className="w-4 h-4" /> },
    { id: 'ollama', label: 'Ollama & Docker', icon: <Box className="w-4 h-4" /> },
    { id: 'playground', label: 'Playground', icon: <Sliders className="w-4 h-4" /> },
    { id: 'history', label: 'Historial & Graph', icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
  ];

  useEffect(() => {
    const checkStatus = async () => {
      const status = await checkDockerOllamaStatus();
      setDockerStatus(status);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProjectPathInput(projectInfo.path);
  }, [projectInfo.path]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const [projects, activeProject] = await Promise.all([
          fetchProjects(),
          fetchActiveProject(),
        ]);
        setSavedProjects(projects);
        if (activeProject) {
          setProjectInfo(activeProject);
        }
      } catch (error) {
        console.error('Error loading saved projects:', error);
      }
    };

    loadProjects();
  }, [setProjectInfo]);

  const handleToggleDocker = async () => {
    setIsControlling(true);
    try {
      if (dockerStatus.running) {
        await stopOllamaDocker();
      } else {
        await startOllamaDocker();
      }
      setTimeout(() => {
        checkDockerOllamaStatus().then(setDockerStatus);
      }, 2000);
    } catch (error) {
      console.error('Error controlling Docker:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const loadProjects = async () => {
    const [projects, activeProject] = await Promise.all([
      fetchProjects(),
      fetchActiveProject(),
    ]);
    setSavedProjects(projects);
    if (activeProject) {
      setProjectInfo(activeProject);
    }
  };

  const handleSaveProject = async () => {
    if (!projectInfo.name.trim() || !projectPathInput.trim()) {
      setProjectError('Debes indicar nombre y ruta real del proyecto.');
      return;
    }

    setIsSavingProject(true);
    setProjectError('');
    setProjectMessage('');

    try {
      const project = await registerProject({
        name: projectInfo.name.trim(),
        path: projectPathInput.trim(),
        description: projectInfo.description || '',
      });
      if (project.id) {
        await activateProject(project.id);
      }
      await loadProjects();
      setProjectInfo(project);
      setProjectPathInput(project.path);
      setProjectMessage('Proyecto guardado y activado en SQLite.');
      setTimeout(() => setProjectMessage(''), 3000);
    } catch (error: any) {
      setProjectError(error.message || 'No se pudo registrar el proyecto.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleActivateProject = async (projectId: string) => {
    if (!projectId) return;

    try {
      await activateProject(projectId);
      const project = savedProjects.find((item) => item.id === projectId);
      if (project) {
        setProjectInfo(project);
        setProjectPathInput(project.path);
      }
      await loadProjects();
    } catch (error: any) {
      setProjectError(error.message || 'No se pudo activar el proyecto.');
    }
  };

  return (
    <aside className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between h-screen p-4 select-none shrink-0">
      <div className="space-y-6">
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              LLM<span className="text-emerald-500 dark:text-emerald-400">X</span>
            </h1>
            <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">v2.0</span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">Control Center Local · TS Hub</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-lg">
          <Circle className={`w-2.5 h-2.5 fill-current ${isOllamaOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`} />
          <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300">
            OLLAMA {isOllamaOnline ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        {/* Docker Control */}
        <div className="space-y-2">
          <button
            onClick={handleToggleDocker}
            disabled={isControlling}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs transition ${
              dockerStatus.running
                ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
            }`}
          >
            {isControlling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : dockerStatus.running ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span className="font-semibold">
              {isControlling ? 'Procesando...' : dockerStatus.running ? 'Detener Ollama' : 'Iniciar Ollama'}
            </span>
          </button>
          {dockerStatus.details && (
            <div className="px-2 space-y-0.5">
              <p className="text-[10px] font-mono text-zinc-500">{dockerStatus.details}</p>
              {dockerStatus.mode && (
                <p className={`text-[10px] font-mono font-semibold ${
                  dockerStatus.mode === 'docker' ? 'text-sky-500 dark:text-blue-400' :
                  dockerStatus.mode === 'local' ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-zinc-400'
                }`}>
                  Modo: {dockerStatus.mode === 'docker' ? '🐳 Docker' : dockerStatus.mode === 'local' ? '💻 Local' : '❓ Desconocido'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2">Navegación</span>
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-xs transition ${
                  isActive
                    ? 'bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400 border border-amber-300 dark:border-emerald-500/30'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Selectores globales de Proyecto y Modelo */}
      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
            <Folder className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> Proyecto Activo
          </label>
          <div className="space-y-2">
            <select
              value={projectInfo.id || ''}
              onChange={(e) => handleActivateProject(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
            >
              <option value="">Selecciona un proyecto guardado</option>
              {savedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={projectInfo.name}
                onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
                placeholder="Nombre del proyecto"
                className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
              />
              <button
                onClick={handleSaveProject}
                disabled={isSavingProject}
                className="px-2 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded text-[10px] font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition disabled:opacity-50"
                type="button"
              >
                {isSavingProject ? '...' : 'Guardar'}
              </button>
            </div>

            <input
              type="text"
              value={projectPathInput}
              onChange={(e) => setProjectPathInput(e.target.value)}
              placeholder="Ruta real del proyecto, ej: C:\\proyectos\\mi-app"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
            />
            {projectInfo.path && (
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5">
                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all">
                  📁 {projectInfo.path}
                </p>
              </div>
            )}
            {projectMessage && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{projectMessage}</p>}
            {projectError && <p className="text-[10px] text-rose-500">{projectError}</p>}
            <p className="text-[10px] text-zinc-500">SQLite guarda el nombre y la ruta real del proyecto activo.</p>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-500 dark:text-blue-400" /> Modelo Activo
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-sky-500 dark:focus:border-blue-500/50"
          >
            {models.length === 0 && <option value="">Sin modelos instalados</option>}
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
};
