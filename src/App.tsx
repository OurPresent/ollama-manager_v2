import React, { useState, useEffect } from 'react';
import { ActiveView, OllamaModel, ProjectInfo } from './types';
import { checkOllamaStatus, fetchInstalledModels } from './services/ollama';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './views/HomeView';
import { ChatView } from './views/ChatView';
import { AgentsView } from './views/AgentsView';
import { PlanesView } from './views/PlanesView';
import { OllamaView } from './views/OllamaView';
import { PlaygroundView } from './views/PlaygroundView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';

type Theme = 'dark' | 'light' | 'system';

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
};

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isOllamaOnline, setIsOllamaOnline] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: 'Proyecto_Demo', path: '' });
  const [projectContext, setProjectContext] = useState<string>('// Contexto general del proyecto...');

  const refreshModels = async () => {
    const status = await checkOllamaStatus();
    setIsOllamaOnline(status.running);
    if (status.running) {
      const list = await fetchInstalledModels();
      setModels(list);
      if (list.length > 0 && !selectedModel) {
        setSelectedModel(list[0].name);
      }
    }
  };

  // Aplicar tema guardado al iniciar la aplicación
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      applyTheme('dark');
    }
  }, []);

  // Escuchar cambios en el tema del sistema cuando está en modo 'system'
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  useEffect(() => {
    refreshModels();
    const interval = setInterval(refreshModels, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 font-sans antialiased text-zinc-800 dark:text-zinc-100 overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOllamaOnline={isOllamaOnline}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        projectInfo={projectInfo}
        setProjectInfo={setProjectInfo}
      />

      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        {activeView === 'home' && (
          <HomeView isOllamaOnline={isOllamaOnline} models={models} setActiveView={setActiveView} />
        )}
        {activeView === 'chat' && (
          <ChatView
            selectedModel={selectedModel}
            projectInfo={projectInfo}
            projectContext={projectContext}
            setProjectContext={setProjectContext}
          />
        )}
        {activeView === 'agents' && (
          <AgentsView
            selectedModel={selectedModel}
            projectInfo={projectInfo}
            projectContext={projectContext}
          />
        )}
        {activeView === 'planes' && (
          <PlanesView
            selectedModel={selectedModel}
            projectInfo={projectInfo}
            projectContext={projectContext}
          />
        )}
        {activeView === 'ollama' && <OllamaView models={models} refreshModels={refreshModels} />}
        {activeView === 'playground' && <PlaygroundView models={models} selectedModel={selectedModel} />}
        {activeView === 'history' && <HistoryView projectInfo={projectInfo} />}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
};

export default App;