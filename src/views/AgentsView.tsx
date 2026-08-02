import React, { useState } from 'react';
import { Plus, Bot, Trash2, Edit2, Settings, Cpu, Power, Upload, FileJson, CheckCircle2, XCircle, Download, RefreshCw, FileText } from 'lucide-react';
import { OllamaModel, PersistedAgent, PersistedSkill } from '../types';
import {
  createAgent,
  deleteAgent,
  fetchAllAgents,
  setAgentActive,
  updateAgent,
  importAgentsBulk,
  validateAgentsBulk,
  fetchAgentsImportTemplate,
  exportAgentsBulk,
} from '../services/systemApi';
import {
  fetchSkills,
  fetchSkillsTemplate,
  importSkillsBulk,
  validateSkillsBulk,
  exportSkillsBulk,
  installSkill,
  uninstallSkill,
  toggleSkill,
  deleteSkill,
} from '../services/skills';

interface Props {
  selectedModel: string;
  models: OllamaModel[];
  agents: PersistedAgent[];
  onAgentsChange: (agents: PersistedAgent[]) => void;
  projectInfo: { name: string; path: string };
  projectContext: string;
}

export const AgentsView: React.FC<Props> = ({
  selectedModel,
  models,
  agents,
  onAgentsChange,
  projectInfo: _projectInfo,
  projectContext: _projectContext,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<PersistedAgent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    systemPrompt: '',
    description: '',
    model: ''
  });
  const [error, setError] = useState('');
  const [executionOutput] = useState<{ [key: string]: string }>({});
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [currentOutput, setCurrentOutput] = useState({ agentName: '', output: '' });

  const [bulkTab, setBulkTab] = useState<'skills' | 'agents'>('skills');
  const [bulkJson, setBulkJson] = useState('');
  const [bulkTemplate, setBulkTemplate] = useState<{ items: string; headers: string[] }>({ items: '', headers: [] });
  const [bulkShowTemplate, setBulkShowTemplate] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    valid?: number;
    imported?: number;
    updated?: number;
    skipped?: number;
    errors: Array<{ index: number; name: string; error: string }>;
    total: number;
    message?: string;
  } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [skills, setSkills] = useState<PersistedSkill[]>([]);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [skillsBusy, setSkillsBusy] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const loadBulkTemplate = async () => {
    try {
      const data =
        bulkTab === 'skills' ? await fetchSkillsTemplate() : await fetchAgentsImportTemplate();
      setBulkTemplate(data);
    } catch (err: unknown) {
      setBulkResult({
        total: 0,
        errors: [],
        message: err instanceof Error ? err.message : 'No se pudo obtener el formato',
      });
    }
  };

  const loadSkills = async () => {
    try {
      setSkills(await fetchSkills());
    } catch {
      setSkills([]);
    }
  };

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkJson(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseBulk = (): unknown[] | null => {
    if (!bulkJson.trim()) {
      setBulkResult({ total: 0, errors: [], message: 'Pega el JSON en el área de texto o selecciona un archivo .json' });
      return null;
    }
    try {
      const value = JSON.parse(bulkJson);
      if (!Array.isArray(value)) {
        setBulkResult({ total: 0, errors: [], message: 'El JSON debe ser un array de objetos.' });
        return null;
      }
      if (value.length === 0) {
        setBulkResult({ total: 0, errors: [], message: 'El array está vacío. Añade al menos un item.' });
        return null;
      }
      return value;
    } catch {
      setBulkResult({ total: 0, errors: [], message: 'JSON inválido. Revisa la sintaxis (comas, llaves y comillas).' });
      return null;
    }
  };

  const handleBulkValidate = async () => {
    const items = parseBulk();
    if (!items) return;
    setBulkBusy(true);
    try {
      const r =
        bulkTab === 'skills' ? await validateSkillsBulk(items) : await validateAgentsBulk(items);
      setBulkResult({ valid: r.valid, errors: r.errors, total: r.total });
    } catch (err: unknown) {
      setBulkResult({ total: 0, errors: [], message: err instanceof Error ? err.message : 'No se pudo validar' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkImport = async () => {
    const items = parseBulk();
    if (!items) return;
    setBulkBusy(true);
    try {
      const r = bulkTab === 'skills' ? await importSkillsBulk(items) : await importAgentsBulk(items);
      setBulkResult({ imported: r.imported, updated: r.updated, skipped: r.skipped, errors: r.errors, total: r.total, message: r.installedErrors?.length ? `${r.failedInstall ?? 0} skills fallaron al instalarse en disco` : undefined });
      await loadSkills();
      await refreshAgents();
      if (bulkTab === 'skills' && r.imported + r.updated > 0) setShowSkillsModal(true);
    } catch (err: unknown) {
      setBulkResult({ total: 0, errors: [], message: err instanceof Error ? err.message : 'No se pudo importar' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkExport = async () => {
    setBulkBusy(true);
    try {
      const items =
        bulkTab === 'skills' ? await exportSkillsBulk() : await exportAgentsBulk();
      if (items.length === 0) {
        setBulkResult({ total: 0, errors: [], message: 'No hay items para exportar todavía.' });
        return;
      }
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bulkTab === 'skills' ? 'skills.json' : 'agentes.json';
      a.click();
      URL.revokeObjectURL(url);
      setBulkResult({ total: items.length, errors: [], message: 'Se descargaron los items.' });
    } catch (err: unknown) {
      setBulkResult({ total: 0, errors: [], message: err instanceof Error ? err.message : 'No se pudo exportar' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSkillInstall = async (skill: PersistedSkill, scope: 'project' | 'global') => {
    setSkillsBusy(skill.id);
    try {
      await installSkill(skill.id, scope);
      await loadSkills();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo instalar el skill');
    } finally {
      setSkillsBusy(null);
    }
  };

  const handleSkillUninstall = async (skill: PersistedSkill) => {
    setSkillsBusy(skill.id);
    try {
      await uninstallSkill(skill.id);
      await loadSkills();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo desinstalar el skill');
    } finally {
      setSkillsBusy(null);
    }
  };

  const handleSkillToggle = async (skill: PersistedSkill) => {
    setSkillsBusy(skill.id);
    try {
      await toggleSkill(skill.id, skill.is_active !== 1);
      await loadSkills();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el skill');
    } finally {
      setSkillsBusy(null);
    }
  };

  const handleSkillDelete = async (skill: PersistedSkill) => {
    setSkillsBusy(skill.id);
    try {
      await deleteSkill(skill.id);
      await loadSkills();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el skill');
    } finally {
      setSkillsBusy(null);
    }
  };

  const refreshAgents = async () => {
    try {
      const data = await fetchAllAgents();
      onAgentsChange(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los agentes');
    }
  };

  const handleToggleActive = async (agent: PersistedAgent) => {
    const next = agent.isActive === false;
    try {
      await setAgentActive(agent.id, next);
      await refreshAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado del agente');
    }
  };

  const handleAddAgent = () => {
    setEditingAgent(null);
    setFormData({ name: '', role: '', systemPrompt: '', description: '', model: '' });
    setShowAddModal(true);
  };

  const handleEditAgent = (agent: PersistedAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      role: agent.role,
      systemPrompt: agent.systemPrompt,
      description: agent.description,
      model: agent.model || ''
    });
    setShowAddModal(true);
  };

  const handleSaveAgent = async () => {
    if (!formData.name || !formData.role || !formData.systemPrompt) return;

    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, formData);
      } else {
        await createAgent(formData);
      }
      await refreshAgents();
      setShowAddModal(false);
      setFormData({ name: '', role: '', systemPrompt: '', description: '', model: '' });
      setEditingAgent(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el agente');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await deleteAgent(id);
      await refreshAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el agente');
    }
  };

  const handleShowOutput = (agent: PersistedAgent) => {
    const output = executionOutput[agent.id] || 'Sin output';
    setCurrentOutput({ agentName: agent.name, output });
    setShowOutputModal(true);
  };

  const getStatusColor = (status: PersistedAgent['status']) => {
    switch (status) {
      case 'idle': return 'text-zinc-400 dark:text-zinc-400';
      case 'running': return 'text-amber-500 dark:text-amber-400';
      case 'completed': return 'text-emerald-600 dark:text-emerald-400';
      case 'error': return 'text-rose-500 dark:text-rose-400';
    }
  };

  const getStatusIcon = (status: PersistedAgent['status']) => {
    switch (status) {
      case 'idle': return <Settings className="w-4 h-4" />;
      case 'running': return <Settings className="w-4 h-4" />;
      case 'completed': return <Settings className="w-4 h-4" />;
      case 'error': return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-800 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-amber-500 dark:text-emerald-400" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">Gestor de Agentes</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Administra y configura tus agentes especializados</p>
          </div>
        </div>
        <button
          onClick={handleAddAgent}
          className="flex items-center gap-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Agente
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-mono text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Bulk Import */}
      <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 rounded-lg">
              <Upload className="w-5 h-5 text-sky-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-zinc-800 dark:text-zinc-100">Carga masiva (JSON)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Importa o exporta skills y agentes desde un archivo JSON
              </p>
            </div>
          </div>
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <button
              onClick={() => { setBulkTab('skills'); setBulkResult(null); loadBulkTemplate(); }}
              className={`px-4 py-2 font-mono text-xs transition ${bulkTab === 'skills' ? 'bg-sky-50 dark:bg-blue-500/10 text-sky-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              Skills
            </button>
            <button
              onClick={() => { setBulkTab('agents'); setBulkResult(null); loadBulkTemplate(); }}
              className={`px-4 py-2 font-mono text-xs transition ${bulkTab === 'agents' ? 'bg-sky-50 dark:bg-blue-500/10 text-sky-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              Agentes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Formato esperado: <strong>array de objetos</strong> con headers{' '}
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="text-sky-600 dark:text-blue-400 underline"
                >
                  ver formato
                </button>
              </p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-mono text-xs transition">
                  <FileJson className="w-3.5 h-3.5" />
                  Archivo .json
                  <input type="file" accept=".json,application/json" onChange={handleBulkFile} className="hidden" />
                </label>
                <button
                  onClick={() => setBulkShowTemplate(!bulkShowTemplate)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
                  title="Previsualizar formato"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {bulkShowTemplate && (
              <pre className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                {bulkTemplate.items || 'Cargando formato...'}
              </pre>
            )}

            <textarea
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              placeholder={`Pega aquí el JSON (array)…\nEj: [{"name": "…", …}]`}
              rows={9}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50 resize-y"
            />

            <div className="flex gap-2">
              <button
                onClick={handleBulkValidate}
                disabled={bulkBusy}
                className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Validar
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkBusy}
                className="flex items-center gap-2 bg-sky-50 dark:bg-emerald-500/10 border border-sky-300 dark:border-emerald-500/30 text-sky-600 dark:text-emerald-400 hover:bg-sky-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50"
              >
                {bulkBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar
              </button>
              <button
                onClick={handleBulkExport}
                disabled={bulkBusy}
                className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Resultado</p>
            {bulkResult ? (
              <div className="space-y-2">
                {bulkResult.message && (
                  <p className="text-xs font-mono text-amber-600 dark:text-amber-400">{bulkResult.message}</p>
                )}
                {!bulkResult.message && bulkResult.errors.length === 0 && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                    ✓{' '}
                    {bulkResult.imported !== undefined
                      ? `${bulkResult.imported} importados, ${bulkResult.updated} actualizados${bulkResult.skipped ? `, ${bulkResult.skipped} omitidos` : ''} de ${bulkResult.total}`
                      : `Los ${bulkResult.valid ?? 0} items son válidos (sin errores)`}
                  </p>
                )}
                {bulkResult.errors.length > 0 && (
                  <>
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                      ✓{' '}
                      {bulkResult.imported !== undefined
                        ? `${bulkResult.imported} importados, ${bulkResult.updated} actualizados${bulkResult.skipped ? `, ${bulkResult.skipped} omitidos` : ''} de ${bulkResult.total}`
                        : `${bulkResult.valid ?? 0} válidos de ${bulkResult.total}`}
                    </p>
                    <div className="max-h-44 overflow-y-auto rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-2 space-y-1">
                      {bulkResult.errors.map((e, i) => (
                        <p key={i} className="text-[11px] font-mono text-rose-600 dark:text-rose-300">
                          #{e.index + 1} {e.name && `«${e.name}» `}— {e.error}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500">
                <XCircle className="w-6 h-6 mb-2" />
                <p className="text-xs font-mono">Pega el JSON y usa Validar o Importar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Total Agentes</p>
          <p className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">{agents.length}</p>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Activos</p>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {agents.filter(a => a.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">En Ejecución</p>
          <p className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400">
            {agents.filter(a => a.status === 'running').length}
          </p>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Modelo Activo</p>
          <p className="text-sm font-mono font-bold text-sky-600 dark:text-blue-400 truncate">
            {selectedModel || 'No seleccionado'}
          </p>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const isActive = agent.isActive !== false;
          return (
          <div
            key={agent.id}
            className={`bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 hover:border-amber-300 dark:hover:border-zinc-700 transition ${!isActive ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 rounded-lg">
                  <Bot className="w-5 h-5 text-amber-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-zinc-800 dark:text-zinc-100">{agent.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(agent)}
                  title={isActive ? 'Desactivar agente' : 'Activar agente'}
                  className={`relative w-10 h-5 rounded-full transition ${isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : ''}`}
                  />
                </button>
                <div className={`flex items-center gap-1 ${getStatusColor(agent.status)}`}>
                  {getStatusIcon(agent.status)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <Power className="w-3 h-3" />
              <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}>
                {isActive ? 'Activo en pipeline' : 'Desactivado (no se ejecuta en Planes)'}
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{agent.description}</p>

            <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1">System Prompt:</p>
              <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 line-clamp-2">{agent.systemPrompt}</p>
            </div>

            {agent.model ? (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-600 dark:text-blue-400">
                <Cpu className="w-3 h-3" />
                Modelo asignado: <strong>{agent.model}</strong>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                <Cpu className="w-3 h-3" />
                Usa el modelo global: <strong>{selectedModel || 'sin definir'}</strong>
              </div>
            )}

            {agent.isBuiltin && (
              <p className="text-[10px] font-mono text-sky-600 dark:text-blue-400">Agente base persistido en SQLite</p>
            )}

            {agent.lastExecution && (
              <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                Última ejecución: {agent.lastExecution}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              {executionOutput[agent.id] && (
                <button
                  onClick={() => handleShowOutput(agent)}
                  className="p-2 bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 rounded-lg transition"
                  title="Ver output"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => handleEditAgent(agent)}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteAgent(agent.id)}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Output Modal */}
      {showOutputModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100">
                Output: {currentOutput.agentName}
              </h2>
              <button
                onClick={() => setShowOutputModal(false)}
                className="text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {currentOutput.output}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100 mb-4">
              {editingAgent ? 'Editar Agente' : 'Nuevo Agente'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">Nombre del Agente</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Desarrollador Backend Senior"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 font-mono text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">Rol / Categoría</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Ej: Backend Developer"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 font-mono text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe las responsabilidades y capacidades del agente..."
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 font-sans text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">Modelo del Agente</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 font-mono text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
                >
                  <option value="">Usar modelo global (${selectedModel || 'sin definir'})</option>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 mt-1.5">
                  Si no eliges modelo, el agente usará el modelo seleccionado globalmente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Instrucciones detalladas para el comportamiento del agente..."
                  rows={4}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-300 focus:outline-none focus:border-amber-500 dark:focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-lg font-mono text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAgent}
                disabled={!formData.name || !formData.role || !formData.systemPrompt}
                className="flex-1 bg-amber-50 dark:bg-emerald-500/10 border border-amber-300 dark:border-emerald-500/30 text-amber-600 dark:text-emerald-400 hover:bg-amber-100 dark:hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-mono text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingAgent ? 'Guardar Cambios' : 'Crear Agente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100">
                Formato {bulkTab === 'skills' ? 'de Skills' : 'de Agentes'}
              </h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Headers requeridos{' '}
                <span className="text-rose-500">(*)</span> — el resto son opcionales:
              </p>
              <div className="flex flex-wrap gap-2">
                {bulkTemplate.headers.map((h, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded-lg font-mono text-[11px] border ${h.endsWith('*') ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    {h}
                  </span>
                ))}
              </div>
              <pre className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto">
                {bulkTemplate.items || 'Cargando formato...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Skills Modal */}
      {showSkillsModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-mono font-bold text-zinc-800 dark:text-zinc-100">
                Skills instalados ({skills.length})
              </h2>
              <button
                onClick={() => setShowSkillsModal(false)}
                className="text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl"
              >
                ×
              </button>
            </div>
            {skills.length === 0 ? (
              <p className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
                No hay skills registrados. Importa un JSON para empezar.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {skills.map((s) => {
                  const installed = s.installedProject || s.installedGlobal;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-zinc-800 dark:text-zinc-100 truncate">{s.name}</p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {s.scope}
                          </span>
                          {s.is_active === 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              activo
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-md">
                          {s.description || 'Sin descripción'} ·{' '}
                          {s.installedProject || s.installedGlobal
                            ? `instalado${s.installedProject ? ' (proyecto)' : ''}${s.installedGlobal ? ' (global)' : ''}`
                            : 'no instalado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3">
                        {!installed ? (
                          <>
                            <button
                              onClick={() => handleSkillInstall(s, 'project')}
                              disabled={skillsBusy === s.id}
                              className="px-2 py-1 text-[10px] font-mono bg-sky-50 dark:bg-blue-500/10 border border-sky-300 dark:border-blue-500/30 text-sky-600 dark:text-blue-400 hover:bg-sky-100 dark:hover:bg-blue-500/20 rounded-lg transition disabled:opacity-50"
                              title="Instalar en el proyecto activo (.opencode/skills)"
                            >
                              Instalar
                            </button>
                            <button
                              onClick={() => handleSkillInstall(s, 'global')}
                              disabled={skillsBusy === s.id}
                              className="px-2 py-1 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition disabled:opacity-50"
                              title="Instalar globalmente (~/.agents/skills)"
                            >
                              Global
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSkillUninstall(s)}
                            disabled={skillsBusy === s.id}
                            className="px-2 py-1 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition disabled:opacity-50"
                          >
                            Desinstalar
                          </button>
                        )}
                        <button
                          onClick={() => handleSkillToggle(s)}
                          disabled={skillsBusy === s.id}
                          className={`px-2 py-1 text-[10px] font-mono rounded-lg border transition disabled:opacity-50 ${s.is_active === 1 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}`}
                        >
                          {s.is_active === 1 ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleSkillDelete(s)}
                          disabled={skillsBusy === s.id}
                          className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                          title="Eliminar skill"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
