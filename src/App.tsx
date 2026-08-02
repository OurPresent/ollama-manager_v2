import React, { useState, useEffect } from 'react';
import { ActiveView, OllamaModel, PersistedAgent, ProjectInfo } from './types';
import { checkOllamaStatus, fetchInstalledModels, setCachedOllamaBaseUrl } from './services/ollama';
import { fetchActiveProject, fetchAllAgents, getAppSettings, Theme } from './services/systemApi';
import { fetchProjectContext } from './services/apiDb';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './views/HomeView';
import { ChatView } from './views/ChatView';
import { AgentsView } from './views/AgentsView';
import { PlanesView } from './views/PlanesView';
import { OllamaView } from './views/OllamaView';
import { PlaygroundView } from './views/PlaygroundView';
import { HistoryView } from './views/HistoryView';
import { OpenCodeView } from './views/OpenCodeView';
import { SettingsView } from './views/SettingsView';

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
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    return 'dark';
  });
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', path: '' });
  const [projectContext, setProjectContext] = useState<string>('// Contexto general del proyecto...');
  const [agents, setAgents] = useState<PersistedAgent[]>([]);

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

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [settings, activeProject] = await Promise.all([
          getAppSettings(),
          fetchActiveProject(),
        ]);

        setTheme(settings.theme || 'dark');
        setCachedOllamaBaseUrl(settings.ollamaUrl);
        if (activeProject) {
          setProjectInfo(activeProject);
          // Pre-cargar contexto estructural generado por el indexador
          try {
            const blocks = await fetchProjectContext(activeProject.id);
            const summary = blocks.find((b) => b.blockType === 'summary');
            const tree = blocks.find((b) => b.blockType === 'tree');
            const parts = [summary?.content, tree?.content].filter(Boolean).join('\n\n');
            if (parts) {
              setProjectContext(parts);
            }
          } catch (err) {
            console.warn('No se pudo precargar el contexto del proyecto:', err);
          }
        }
      } catch (error) {
        applyTheme('dark');
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    refreshModels();
    const interval = setInterval(refreshModels, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAllAgents().then(setAgents).catch(() => setAgents([]));
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
          <HomeView isOllamaOnline={isOllamaOnline} models={models} agents={agents} setActiveView={setActiveView} />
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
            models={models}
            agents={agents}
            onAgentsChange={setAgents}
            projectInfo={projectInfo}
            projectContext={projectContext}
          />
        )}
        {activeView === 'planes' && (
          <PlanesView
            selectedModel={selectedModel}
            projectInfo={projectInfo}
            projectContext={projectContext}
            agents={agents}
          />
        )}
        {activeView === 'ollama' && <OllamaView models={models} refreshModels={refreshModels} />}
        {activeView === 'opencode' && <OpenCodeView projectInfo={projectInfo} />}
        {activeView === 'playground' && <PlaygroundView models={models} selectedModel={selectedModel} />}
        {activeView === 'history' && <HistoryView projectInfo={projectInfo} />}
        {activeView === 'settings' && (
          <SettingsView
            onThemeSaved={setTheme}
            onOllamaUrlSaved={(url) => setCachedOllamaBaseUrl(url)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
