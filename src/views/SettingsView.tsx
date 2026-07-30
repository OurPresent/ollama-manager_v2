import React, { useState, useEffect } from 'react';
import { Settings, Sun, Moon, Monitor, Server, Cpu, Palette, Save, AlertTriangle, Terminal, Globe } from 'lucide-react';
import { checkOllamaStatus, startOllama, stopOllama } from '../services/ollama';
import { checkDockerOllamaStatus, startOllamaDocker, stopOllamaDocker, restartOllamaDocker, getDockerInfo, DockerStatus, DockerInfo } from '../services/dockerControl';

interface ServiceConfig {
  ollamaUrl: string;
  ollamaMode: 'docker' | 'local';
}

type Theme = 'dark' | 'light' | 'system';

export const SettingsView: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [loading, setLoading] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
    ollamaUrl: 'http://localhost:11434',
    ollamaMode: 'local'
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState({ running: false, details: '' });
  const [dockerStatus, setDockerStatus] = useState<DockerStatus>({ running: false, details: '', mode: 'unknown' });
  const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);

  // Cargar tema y configuración guardada
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }

    const savedConfig = localStorage.getItem('serviceConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setServiceConfig({
          ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
          ollamaMode: config.ollamaMode || 'local'
        });
      } catch (error) {
        console.error('Error loading service config:', error);
      }
    }
  }, []);

  // Verificar estado de servicios al montar
  useEffect(() => {
    checkServicesStatus();
  }, []);

  const applyTheme = (selectedTheme: Theme) => {
    const root = document.documentElement;
    
    if (selectedTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', selectedTheme === 'dark');
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const checkServicesStatus = async () => {
    const status = await checkOllamaStatus();
    setOllamaStatus(status);
    const dStatus = await checkDockerOllamaStatus();
    setDockerStatus(dStatus);
    const dInfo = await getDockerInfo();
    setDockerInfo(dInfo);
  };

  const handleRestartOllama = async () => {
    setLoading(true);
    try {
      await restartOllamaDocker();
      await checkServicesStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDockerOllama = async () => {
    setLoading(true);
    try {
      await startOllamaDocker();
      await checkServicesStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopDockerOllama = async () => {
    setLoading(true);
    try {
      await stopOllamaDocker();
      await checkServicesStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaveError('');
    setSaveMessage('');

    // Verificar si Ollama está corriendo antes de guardar
    const status = await checkOllamaStatus();
    if (status.running) {
      setSaveError('⚠️ No se puede guardar la configuración mientras Ollama está en ejecución. Detén el servicio primero.');
      return;
    }

    localStorage.setItem('serviceConfig', JSON.stringify(serviceConfig));
    setSaveMessage('✓ Configuración guardada');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleStartOllama = async () => {
    setLoading(true);
    try {
      await startOllama();
      await checkServicesStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopOllama = async () => {
    setLoading(true);
    try {
      await stopOllama();
      await checkServicesStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-amber-500 dark:text-emerald-400" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Configuración</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestiona servicios, tema y preferencias</p>
          </div>
        </div>
      </header>

      {/* Sección de Tema */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6 text-sky-500 dark:text-blue-400" />
          <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Apariencia</h2>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Selecciona el tema de la interfaz:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'dark', label: 'Oscuro', icon: Moon, desc: 'Tema oscuro' },
              { value: 'light', label: 'Claro', icon: Sun, desc: 'Tema claro' },
              { value: 'system', label: 'Sistema', icon: Monitor, desc: 'Automático' }
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleThemeChange(option.value as Theme)}
                  className={`p-4 rounded-lg border-2 transition ${
                    isSelected
                      ? 'border-amber-500/50 dark:border-emerald-500/50 bg-amber-50 dark:bg-emerald-500/10'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-8 h-8 ${isSelected ? 'text-amber-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-400'}`} />
                    <span className={`font-mono text-sm font-bold ${isSelected ? 'text-amber-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                      {option.label}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{option.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sección de Servicios */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-amber-500 dark:text-emerald-400" />
          <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Servicios</h2>
        </div>

        {/* Configuración de Endpoints */}
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Configuración de Endpoints:</p>
          
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
                Ollama Endpoint:
              </label>
              <input
                type="text"
                value={serviceConfig.ollamaUrl}
                onChange={(e) => setServiceConfig({ ...serviceConfig, ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
              />
            </div>

            {/* Modo de Ejecución de Ollama */}
            <div>
              <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
                Modo de Ejecución de Ollama:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setServiceConfig({ ...serviceConfig, ollamaMode: 'local' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border font-mono text-xs transition ${
                    serviceConfig.ollamaMode === 'local'
                      ? 'border-amber-500/50 dark:border-emerald-500/50 bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Local
                </button>
                <button
                  onClick={() => setServiceConfig({ ...serviceConfig, ollamaMode: 'docker' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border font-mono text-xs transition ${
                    serviceConfig.ollamaMode === 'docker'
                      ? 'border-amber-500/50 dark:border-emerald-500/50 bg-amber-50 dark:bg-emerald-500/10 text-amber-600 dark:text-emerald-400'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Docker
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
                {serviceConfig.ollamaMode === 'docker'
                  ? 'Ollama se ejecuta dentro de un contenedor Docker'
                  : 'Ollama se ejecuta directamente en el sistema local'}
              </p>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 rounded-lg font-mono text-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Configuración
            </button>
            {saveMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center font-mono">{saveMessage}</p>
            )}
            {saveError && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-mono">{saveError}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
          {/* Ollama Service (via API) */}
          <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-5 h-5 text-amber-500 dark:text-emerald-400" />
                  <h3 className="font-mono font-bold text-zinc-800 dark:text-zinc-100">Ollama (API)</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    ollamaStatus.running
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {ollamaStatus.running ? 'Corriendo' : 'Detenido'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Puerto: 11434</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                  {ollamaStatus.details || 'No disponible'}
                </p>
              </div>
              
              <div className="flex gap-2">
                {!ollamaStatus.running ? (
                  <button
                    onClick={handleStartOllama}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 rounded-lg font-mono text-xs transition disabled:opacity-50"
                  >
                    Iniciar
                  </button>
                ) : (
                  <button
                    onClick={handleStopOllama}
                    disabled={loading}
                    className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg font-mono text-xs transition disabled:opacity-50"
                  >
                    Detener
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Docker / Ollama Service (via Python) */}
          <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-sky-500 dark:text-blue-400" />
                  <h3 className="font-mono font-bold text-zinc-800 dark:text-zinc-100">Docker / Ollama (Python)</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    dockerStatus.running
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {dockerStatus.running ? 'Corriendo' : 'Detenido'}
                  </span>
                  {dockerStatus.mode && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      dockerStatus.mode === 'docker'
                        ? 'bg-sky-50 dark:bg-blue-500/20 text-sky-600 dark:text-blue-400'
                        : dockerStatus.mode === 'local'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {dockerStatus.mode === 'docker' ? '🐳 Docker' : dockerStatus.mode === 'local' ? '💻 Local' : '❓ Desconocido'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Controlado por Python</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                  {dockerStatus.details || 'No disponible'}
                </p>
              </div>
              
              <div className="flex gap-2">
                {!dockerStatus.running ? (
                  <button
                    onClick={handleStartDockerOllama}
                    disabled={loading}
                    className="px-4 py-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 rounded-lg font-mono text-xs transition disabled:opacity-50"
                  >
                    Iniciar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRestartOllama}
                      disabled={loading}
                      className="px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg font-mono text-xs transition disabled:opacity-50"
                    >
                      Reiniciar
                    </button>
                    <button
                      onClick={handleStopDockerOllama}
                      disabled={loading}
                      className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg font-mono text-xs transition disabled:opacity-50"
                    >
                      Detener
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={checkServicesStatus}
          className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-mono text-xs transition"
        >
          Actualizar Estado
        </button>
      </div>

      {/* Información del Sistema */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Información</h2>
        
        <div className="space-y-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex justify-between">
            <span>Backend:</span>
            <span className="text-zinc-700 dark:text-zinc-300">http://localhost:8502</span>
          </div>
          <div className="flex justify-between">
            <span>Ollama:</span>
            <span className="text-zinc-700 dark:text-zinc-300">{serviceConfig.ollamaUrl}</span>
          </div>
          <div className="flex justify-between">
            <span>Modo Ollama:</span>
            <span className={`${serviceConfig.ollamaMode === 'docker' ? 'text-sky-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {serviceConfig.ollamaMode === 'docker' ? '🐳 Docker' : '💻 Local'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Docker Detectado:</span>
            <span className={dockerInfo?.docker_installed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
              {dockerInfo?.docker_installed ? '✅ Sí' : '❌ No'}
            </span>
          </div>
          {dockerInfo?.docker_version && (
            <div className="flex justify-between">
              <span>Versión Docker:</span>
              <span className="text-zinc-700 dark:text-zinc-300">{dockerInfo.docker_version}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Docker Activo:</span>
            <span className={dockerInfo?.docker_running ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
              {dockerInfo?.docker_running ? '✅ Sí' : '❌ No'}
            </span>
          </div>
          {dockerInfo?.ollama_container && (
            <>
              <div className="flex justify-between">
                <span>Contenedor Ollama:</span>
                <span className="text-sky-600 dark:text-blue-400">{dockerInfo.ollama_container.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Estado Contenedor:</span>
                <span className="text-zinc-700 dark:text-zinc-300">{dockerInfo.ollama_container.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Imagen:</span>
                <span className="text-zinc-700 dark:text-zinc-300">{dockerInfo.ollama_container.image}</span>
              </div>
              <div className="flex justify-between">
                <span>Puertos:</span>
                <span className="text-zinc-700 dark:text-zinc-300">{dockerInfo.ollama_container.ports}</span>
              </div>
            </>
          )}
          {dockerInfo && dockerInfo.containers.length > 0 && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-400 dark:text-zinc-500 mb-1">Contenedores ({dockerInfo.containers.length}):</p>
              {dockerInfo.containers.map((c, i) => (
                <div key={i} className="flex justify-between pl-2">
                  <span className="text-zinc-700 dark:text-zinc-300">{c.name}</span>
                  <span className={c.status.toLowerCase().includes('up') ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};