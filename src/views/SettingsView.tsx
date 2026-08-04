import React, { useState, useEffect } from 'react';
import { Settings, Sun, Moon, Monitor, Server, Cpu, Palette, Save, AlertTriangle, Terminal, Globe, Download, Upload, RefreshCw, MonitorSmartphone, DatabaseBackup, HardDrive, Trash2 } from 'lucide-react';
import { checkOllamaStatus, setCachedOllamaBaseUrl, startOllama, stopOllama } from '../services/ollama';
import { checkDockerOllamaStatus, startOllamaDocker, stopOllamaDocker, restartOllamaDocker, getDockerInfo, DockerStatus, DockerInfo } from '../services/dockerControl';
import { AppSettings, getAppSettings, saveAppSettings, Theme } from '../services/systemApi';
import {
  fetchDeviceInfo,
  prepareEnvironment,
  createBackup,
  restoreBackup,
  DeviceInfo,
  EnvReport,
  BackupPayload,
} from '../services/systemApi';
import { getBackendUrl } from '../services/backend';
import { fetchDbSize, cleanupData, compactDatabase, CleanupTargets } from '../services/apiDb';
import { useToast } from '../components/Toast';

interface SettingsViewProps {
  onThemeSaved?: (theme: Theme) => void;
  onOllamaUrlSaved?: (url: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onThemeSaved, onOllamaUrlSaved }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [loading, setLoading] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<Omit<AppSettings, 'theme'>>({
    ollamaUrl: 'http://localhost:11434',
    ollamaMode: 'local'
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState({ running: false, details: '' });
  const [dockerStatus, setDockerStatus] = useState<DockerStatus>({ running: false, details: '', mode: 'unknown' });
  const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [envReport, setEnvReport] = useState<EnvReport | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [dbSize, setDbSize] = useState(0);
  const [cleanupTargets, setCleanupTargets] = useState<CleanupTargets>({
    chats: true,
    opencode: true,
    plans: true,
    taskLogs: true,
    queries: true,
    graph: true,
    audit: true,
    systemLogs: true,
    approvals: true,
  });
  const [cleanupOlderDays, setCleanupOlderDays] = useState(0);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const config = await getAppSettings();
        setTheme(config.theme || 'dark');
        applyTheme(config.theme || 'dark');
        setServiceConfig({
          ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
          ollamaMode: config.ollamaMode || 'local'
        });
        setCachedOllamaBaseUrl(config.ollamaUrl || 'http://localhost:11434');
      } catch (error) {
        console.error('Error loading service config from SQLite:', error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    checkServicesStatus();
  }, []);

  const loadDbSize = async () => {
    try {
      setDbSize(await fetchDbSize());
    } catch (error) {
      console.error('Error obteniendo tamaño de la base de datos:', error);
    }
  };

  useEffect(() => {
    loadDbSize();
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
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDockerOllama = async () => {
    setLoading(true);
    try {
      await startOllamaDocker();
      await checkServicesStatus();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopDockerOllama = async () => {
    setLoading(true);
    try {
      await stopOllamaDocker();
      await checkServicesStatus();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
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

    try {
      await saveAppSettings({
        theme,
        ollamaUrl: serviceConfig.ollamaUrl,
        ollamaMode: serviceConfig.ollamaMode,
      });
      setCachedOllamaBaseUrl(serviceConfig.ollamaUrl);
      onThemeSaved?.(theme);
      onOllamaUrlSaved?.(serviceConfig.ollamaUrl);
      setSaveMessage('✓ Configuración guardada en SQLite');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleStartOllama = async () => {
    setLoading(true);
    try {
      await startOllama();
      await checkServicesStatus();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopOllama = async () => {
    setLoading(true);
    try {
      await stopOllama();
      await checkServicesStatus();
    } catch (error: unknown) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceInfo = async () => {
    setDeviceBusy(true);
    try {
      setDeviceInfo(await fetchDeviceInfo());
    } catch (error: unknown) {
      showToast('error', 'Dispositivo', error instanceof Error ? error.message : 'No se pudo obtener la información');
    } finally {
      setDeviceBusy(false);
    }
  };

  useEffect(() => {
    loadDeviceInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrepare = async () => {
    setDeviceBusy(true);
    try {
      const report = await prepareEnvironment();
      setEnvReport(report);
      const okCount = report.checks.filter((c) => c.status === 'ok').length;
      showToast('success', 'Análisis de entorno', `${okCount}/${report.checks.length} herramientas disponibles`);
    } catch (error: unknown) {
      showToast('error', 'Análisis de entorno', error instanceof Error ? error.message : 'Error');
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleBackup = async () => {
    setDeviceBusy(true);
    setBackupMsg('');
    try {
      const payload = await createBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ollama-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const kb = Math.round(payload.sizeBytes / 1024);
      setBackupMsg(`Respaldo descargado (${kb} KB).`);
      showToast('success', 'Respaldo creado', `Se descargó el respaldo de la base de datos (${kb} KB).`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo crear el respaldo';
      setBackupMsg(msg);
      showToast('error', 'Respaldo', msg);
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setDeviceBusy(true);
      setBackupMsg('');
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as BackupPayload;
        if (!parsed.databaseBase64 || !parsed.app) {
          throw new Error('El archivo no parece ser un respaldo de ollama-manager.');
        }
        if (!window.confirm('Se reemplazará la base de datos actual con la del respaldo. ¿Continuar?')) {
          return;
        }
        await restoreBackup(parsed);
        setBackupMsg('Base de datos restaurada correctamente.');
        showToast('success', 'Respaldo restaurado', 'La base de datos fue reemplazada por la del respaldo.');
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'No se pudo restaurar el respaldo';
        setBackupMsg(msg);
        showToast('error', 'Restaurar respaldo', msg);
      } finally {
        setDeviceBusy(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
  };

  const handleCleanup = async () => {
    if (!Object.values(cleanupTargets).some(Boolean)) {
      showToast('error', 'Limpieza', 'Selecciona al menos un tipo de dato a limpiar.');
      return;
    }
    if (!window.confirm('Se eliminarán permanentemente los datos seleccionados. ¿Continuar?')) return;
    setMaintenanceBusy(true);
    setMaintenanceMsg('');
    try {
      const result = await cleanupData({
        targets: cleanupTargets,
        olderThanDays: cleanupOlderDays > 0 ? cleanupOlderDays : undefined,
      });
      const total = Object.values(result.counts).reduce((a, b) => a + (b || 0), 0);
      setMaintenanceMsg(
        `Limpieza completada (${total} registros). BD: ${formatBytes(result.sizeBytesBefore)} → ${formatBytes(result.sizeBytesAfter)}`
      );
      await loadDbSize();
      showToast('success', 'Limpieza', `${total} registros eliminados.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error durante la limpieza';
      setMaintenanceMsg(msg);
      showToast('error', 'Limpieza', msg);
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handleCompact = async () => {
    setMaintenanceBusy(true);
    setMaintenanceMsg('');
    try {
      const r = await compactDatabase();
      setMaintenanceMsg(`Base de datos compactada: ${formatBytes(r.sizeBytesBefore)} → ${formatBytes(r.sizeBytesAfter)}`);
      await loadDbSize();
      showToast('success', 'Compactación', 'Base de datos compactada.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al compactar la base de datos';
      setMaintenanceMsg(msg);
      showToast('error', 'Compactación', msg);
    } finally {
      setMaintenanceBusy(false);
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

      {/* Sección Dispositivo */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="w-6 h-6 text-amber-500 dark:text-emerald-400" />
          <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Dispositivo</h2>
          <div className="flex-1" />
          <button
            onClick={loadDeviceInfo}
            disabled={deviceBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-mono text-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${deviceBusy ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {deviceInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Sistema operativo', value: `${deviceInfo.platform === 'win32' ? 'Windows' : deviceInfo.platform === 'darwin' ? 'macOS' : 'Linux'} · ${deviceInfo.release}` },
              { label: 'Arquitectura', value: deviceInfo.architecture },
              { label: 'Equipo', value: deviceInfo.hostname },
              { label: 'CPU', value: `${deviceInfo.cpus} núcleos` },
              { label: 'Memoria', value: `${formatBytes(deviceInfo.freeMem)} libres de ${formatBytes(deviceInfo.totalMem)}` },
              { label: 'Tiempo activo', value: `${Math.floor(deviceInfo.uptimeSec / 60 / 60)}h ${Math.floor((deviceInfo.uptimeSec % 3600) / 60)}m` },
              { label: 'Node.js', value: deviceInfo.nodeVersion || 'no detectado' },
              { label: 'npm', value: deviceInfo.npmVersion || 'no detectado' },
              { label: 'Ollama', value: deviceInfo.ollamaInstalled ? 'instalado' : 'no detectado' },
              { label: 'OpenCode', value: deviceInfo.opencodeInstalled ? 'instalado' : 'no detectado' },
              { label: 'Docker', value: deviceInfo.dockerAvailable ? (deviceInfo.dockerRunning ? 'corriendo' : 'instalado (detenido)') : 'no detectado' },
              { label: 'Git', value: deviceInfo.gitInstalled ? 'instalado' : 'no detectado' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{row.label}</span>
                <span className="text-[11px] font-mono text-zinc-800 dark:text-zinc-200 truncate ml-2">{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-mono text-zinc-500 dark:text-zinc-400">Cargando información del dispositivo...</p>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <h3 className="font-mono font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-amber-500 dark:text-emerald-400" /> Preparar entorno
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Verifica que las herramientas necesarias estén instaladas (Node, npm, Ollama, OpenCode, Docker, Git) y sugiere qué instalar.
          </p>
          <button
            onClick={handlePrepare}
            disabled={deviceBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 font-mono text-xs transition disabled:opacity-50"
          >
            <HardDrive className="w-3.5 h-3.5" />
            Analizar entorno
          </button>

          {envReport && (
            <div className="mt-3 space-y-2">
              {envReport.checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-[11px] font-mono">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      c.status === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : c.status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-200 w-28">{c.name}</span>
                  <span className="text-zinc-500 dark:text-zinc-400 flex-1">{c.detail}</span>
                </div>
              ))}
              {envReport.suggestions.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg p-3 space-y-1">
                  <p className="text-[10px] font-mono text-amber-700 dark:text-amber-300">Sugerencias:</p>
                  {envReport.suggestions.map((s, i) => (
                    <p key={i} className="text-[11px] font-mono text-amber-700 dark:text-amber-300">• {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sección Respaldos */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="w-6 h-6 text-sky-500 dark:text-blue-400" />
          <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Respaldos</h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Exporta o importa la base de datos completa (modelos, agentes, chats, planes y configuración) como un archivo JSON.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackup}
            disabled={deviceBusy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 font-mono text-xs transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar respaldo
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-mono text-xs transition">
            <Upload className="w-3.5 h-3.5" />
            Importar respaldo
            <input type="file" accept=".json,application/json" onChange={handleRestoreFile} className="hidden" />
          </label>
        </div>

        {deviceInfo && (
          <p className="text-[10px] font-mono text-zinc-400 break-all">
            Base de datos: {deviceInfo.databasePath}
          </p>
        )}
        {backupMsg && (
          <p className={`text-xs font-mono ${backupMsg.startsWith('Respaldo') || backupMsg.startsWith('Base') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
            {backupMsg}
          </p>
        )}
      </div>

      {/* Sección Mantenimiento y limpieza */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Mantenimiento y limpieza</h2>
          <div className="flex-1" />
          <span className="text-[10px] font-mono text-zinc-400">Tamaño actual: <strong className="text-zinc-700 dark:text-zinc-200">{formatBytes(dbSize)}</strong></span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Elimina datos acumulados (chats, ejecuciones, historial) y compacta la base de datos SQLite para recuperar espacio.
        </p>

        <div>
          <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Datos a limpiar:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { key: 'chats', label: 'Chats y mensajes' },
              { key: 'opencode', label: 'Sesiones OpenCode' },
              { key: 'plans', label: 'Planes finalizados' },
              { key: 'taskLogs', label: 'Bitácoras .md (task_logs)' },
              { key: 'queries', label: 'Consultas del proyecto' },
              { key: 'graph', label: 'Grafo de memoria' },
              { key: 'audit', label: 'Auditoría' },
              { key: 'systemLogs', label: 'Logs del sistema' },
              { key: 'approvals', label: 'Aprobaciones resueltas' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 cursor-pointer hover:border-rose-300 dark:hover:border-rose-500/40 transition"
              >
                <input
                  type="checkbox"
                  checked={cleanupTargets[item.key as keyof CleanupTargets]}
                  onChange={(e) =>
                    setCleanupTargets((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="accent-rose-500"
                />
                <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
              Solo registros con más de (días) — 0 = todos
            </label>
            <input
              type="number"
              min={0}
              value={cleanupOlderDays}
              onChange={(e) => setCleanupOlderDays(Math.max(0, Number(e.target.value)))}
              className="w-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50"
            />
          </div>
          <button
            onClick={handleCleanup}
            disabled={maintenanceBusy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-mono text-xs transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Ejecutar limpieza
          </button>
          <button
            onClick={handleCompact}
            disabled={maintenanceBusy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 font-mono text-xs transition disabled:opacity-50"
          >
            <HardDrive className="w-3.5 h-3.5" />
            Compactar base de datos
          </button>
        </div>

        {maintenanceBusy && (
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Procesando…</p>
        )}
        {maintenanceMsg && (
          <p className={`text-xs font-mono ${maintenanceMsg.includes('completada') || maintenanceMsg.includes('compactada') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
            {maintenanceMsg}
          </p>
        )}
      </div>

      {/* Información del Sistema */}
      <div className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-zinc-700 dark:text-zinc-100">Información</h2>
        
        <div className="space-y-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex justify-between">
            <span>Backend:</span>
            <span className="text-zinc-700 dark:text-zinc-300">{getBackendUrl()}</span>
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
