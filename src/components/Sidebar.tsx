import React, { useState, useEffect } from 'react';
import { ActiveView, OllamaModel } from '../types';
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
  FolderOpen,
  Loader2
} from 'lucide-react';
import { checkDockerOllamaStatus, startOllamaDocker, stopOllamaDocker, DockerStatus } from '../services/dockerControl';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isOllamaOnline: boolean;
  models: OllamaModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  projectName: string;
  setProjectName: (name: string) => void;
}

const validateProjectPath = (path: string): string | null => {
  try {
    // Check if path exists and is accessible
    // In a browser environment, we can't directly check file system
    // So we'll validate the format and return the path if it looks valid
    const trimmedPath = path.trim();
    
    // Basic validation: should not be empty and should have a reasonable length
    if (!trimmedPath || trimmedPath.length < 2) {
      return null;
    }
    
    // For Windows paths, check for drive letter pattern (C:\, D:\, etc.)
    const windowsPathPattern = /^[A-Za-z]:\\/;
    // For Unix paths, check for absolute path pattern (/home/, /usr/, etc.)
    const unixPathPattern = /^\//;
    
    // Accept if it matches either Windows or Unix absolute path pattern
    // Or if it's a relative path (doesn't start with special chars)
    if (windowsPathPattern.test(trimmedPath) || unixPathPattern.test(trimmedPath) || !trimmedPath.startsWith('.')) {
      return trimmedPath;
    }
    
    return null;
  } catch {
    return null;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOllamaOnline,
  models,
  selectedModel,
  setSelectedModel,
  projectName,
  setProjectName,
}) => {
  const [dockerStatus, setDockerStatus] = useState<DockerStatus>({ running: false, details: '' });
  const [isControlling, setIsControlling] = useState(false);

  const menuItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat del Proyecto', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'agents', label: 'Agentes & Planes', icon: <Bot className="w-4 h-4" /> },
    { id: 'ollama', label: 'Ollama & Docker', icon: <Box className="w-4 h-4" /> },
    { id: 'playground', label: 'Playground', icon: <Sliders className="w-4 h-4" /> },
    { id: 'history', label: 'Historial & Graph', icon: <History className="w-4 h-4" /> },
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

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between h-screen p-4 select-none shrink-0">
      <div className="space-y-6">
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-zinc-100">
              LLM<span className="text-emerald-400">X</span>
            </h1>
            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">v2.0</span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">Control Center Local · TS Hub</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <Circle className={`w-2.5 h-2.5 fill-current ${isOllamaOnline ? 'text-emerald-400' : 'text-rose-500'}`} />
          <span className="text-xs font-mono font-semibold text-zinc-300">
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
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
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
          {dockerStatus.details && !dockerStatus.running && (
            <p className="text-[10px] font-mono text-zinc-500 px-2">Docker: {dockerStatus.details}</p>
          )}
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-2">Navegación</span>
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-xs transition ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
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
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1.5">
            <Folder className="w-3.5 h-3.5 text-emerald-400" /> Proyecto Activo
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Nombre del proyecto"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={() => {
                // Create a hidden file input element - ONLY to get the folder path, not to upload files
                const input = document.createElement('input');
                input.type = 'file';
                
                // Append to DOM first (required for some browsers)
                document.body.appendChild(input);
                
                // Set directory selection attributes AFTER appending to DOM
                // This ensures the browser recognizes folder selection mode
                input.setAttribute('webkitdirectory', '');
                input.setAttribute('directory', '');
                input.webkitdirectory = true;
                input.style.display = 'none';
                
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files.length > 0) {
                    // Get ONLY the folder name from the first file's path
                    // We do NOT read or store any file contents
                    const firstFilePath = files[0].webkitRelativePath;
                    const folderName = firstFilePath.split('/')[0];
                    
                    // Store only the folder name/path for reference
                    setProjectName(folderName);
                    
                    // IMPORTANT: No files are uploaded or stored
                    // Only the folder path/name is saved
                  }
                };
                
                // Trigger click and cleanup
                input.click();
                document.body.removeChild(input);
              }}
              className="p-1.5 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 transition"
              title="Seleccionar carpeta del proyecto (solo ruta, sin subir archivos)"
              type="button"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Ruta validada del proyecto</p>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" /> Modelo Activo
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50"
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