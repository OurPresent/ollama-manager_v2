import React, { useState } from 'react';
import { Plus, Bot, Trash2, Edit2, Settings } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastExecution?: string;
}

interface Props {
  selectedModel: string;
  projectInfo: { name: string; path: string };
  projectContext: string;
}

export const AgentsView: React.FC<Props> = ({ selectedModel, projectInfo: _projectInfo, projectContext: _projectContext }) => {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      name: 'Gestor de Proyecto Lead',
      role: 'Project Manager',
      systemPrompt: 'Project Manager Senior. Desglosa tareas y estructura la ejecución.',
      description: 'Coordina el flujo de trabajo y descompone objetivos en tareas ejecutables',
      status: 'idle'
    },
    {
      id: '2',
      name: 'Desarrollador Backend',
      role: 'Backend Developer',
      systemPrompt: 'Backend Senior en Python/TypeScript. Escribe arquitectura y código de servicios.',
      description: 'Especialista en arquitectura de servicios, APIs y lógica de negocio',
      status: 'idle'
    },
    {
      id: '3',
      name: 'Desarrollador Frontend',
      role: 'Frontend Developer',
      systemPrompt: 'Frontend Lead en React, TS y Tailwind. Diseña interfaces avanzadas.',
      description: 'Experto en interfaces de usuario, componentes React y experiencia visual',
      status: 'idle'
    },
    {
      id: '4',
      name: 'DBA (SQL/NoSQL)',
      role: 'Database Administrator',
      systemPrompt: 'DBA Experto. Diseña esquemas, relaciones e índices eficientes.',
      description: 'Diseña y optimiza bases de datos, esquemas y consultas',
      status: 'idle'
    },
    {
      id: '5',
      name: 'QA Tester',
      role: 'Quality Assurance',
      systemPrompt: 'Tester QA. Genera estrategias de testing, casos de borde y suite de pruebas.',
      description: 'Garantiza la calidad mediante pruebas automatizadas y manuales',
      status: 'idle'
    },
    {
      id: '6',
      name: 'DevOps Engineer',
      role: 'DevOps',
      systemPrompt: 'Eng DevOps. Diseña Dockerfiles, pipelines CI/CD y configuraciones de despliegue.',
      description: 'Automatiza despliegues, infraestructura y pipelines de integración',
      status: 'idle'
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    systemPrompt: '',
    description: ''
  });
  const [executionOutput] = useState<{ [key: string]: string }>({});
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [currentOutput, setCurrentOutput] = useState({ agentName: '', output: '' });

  const handleAddAgent = () => {
    setEditingAgent(null);
    setFormData({ name: '', role: '', systemPrompt: '', description: '' });
    setShowAddModal(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      role: agent.role,
      systemPrompt: agent.systemPrompt,
      description: agent.description
    });
    setShowAddModal(true);
  };

  const handleSaveAgent = () => {
    if (!formData.name || !formData.role || !formData.systemPrompt) return;

    if (editingAgent) {
      setAgents(agents.map(a =>
        a.id === editingAgent.id
          ? { ...a, ...formData }
          : a
      ));
    } else {
      const newAgent: Agent = {
        id: Date.now().toString(),
        ...formData,
        status: 'idle'
      };
      setAgents([...agents, newAgent]);
    }

    setShowAddModal(false);
    setFormData({ name: '', role: '', systemPrompt: '', description: '' });
    setEditingAgent(null);
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
  };

  const handleShowOutput = (agent: Agent) => {
    const output = executionOutput[agent.id] || 'Sin output';
    setCurrentOutput({ agentName: agent.name, output });
    setShowOutputModal(true);
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return 'text-zinc-400 dark:text-zinc-400';
      case 'running': return 'text-amber-500 dark:text-amber-400';
      case 'completed': return 'text-emerald-600 dark:text-emerald-400';
      case 'error': return 'text-rose-500 dark:text-rose-400';
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Total Agentes</p>
          <p className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100">{agents.length}</p>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">Activos</p>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {agents.filter(a => a.status === 'completed').length}
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
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 hover:border-amber-300 dark:hover:border-zinc-700 transition"
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
              <div className={`flex items-center gap-1 ${getStatusColor(agent.status)}`}>
                {getStatusIcon(agent.status)}
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{agent.description}</p>

            <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
              <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1">System Prompt:</p>
              <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 line-clamp-2">{agent.systemPrompt}</p>
            </div>

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
        ))}
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
    </div>
  );
};