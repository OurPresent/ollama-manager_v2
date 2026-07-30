import React, { useState, useEffect } from 'react';
import { ActiveView, OllamaModel } from './types';
import { checkOllamaStatus, fetchInstalledModels } from './services/ollama';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './views/HomeView';
import { ChatView } from './views/ChatView';
import { AgentsView } from './views/AgentsView';
import { OllamaView } from './views/OllamaView';
import { PlaygroundView } from './views/PlaygroundView';
import { HistoryView } from './views/HistoryView';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isOllamaOnline, setIsOllamaOnline] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('Proyecto_Demo');
  const [projectContext, setProjectContext] = useState<string>('// Contexto general del proyecto...');

  const refreshModels = async () => {
    const online = await checkOllamaStatus();
    setIsOllamaOnline(online);
    if (online) {
      const list = await fetchInstalledModels();
      setModels(list);
      if (list.length > 0 && !selectedModel) {
        setSelectedModel(list[0].name);
      }
    }
  };

  useEffect(() => {
    refreshModels();
    const interval = setInterval(refreshModels, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 font-sans antialiased text-zinc-100 overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOllamaOnline={isOllamaOnline}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        projectName={projectName}
        setProjectName={setProjectName}
      />

      <main className="flex-1 overflow-y-auto bg-zinc-950">
        {activeView === 'home' && (
          <HomeView isOllamaOnline={isOllamaOnline} models={models} setActiveView={setActiveView} />
        )}
        {activeView === 'chat' && (
          <ChatView
            selectedModel={selectedModel}
            projectName={projectName}
            projectContext={projectContext}
            setProjectContext={setProjectContext}
          />
        )}
        {activeView === 'agents' && (
          <AgentsView
            selectedModel={selectedModel}
            projectName={projectName}
            projectContext={projectContext}
          />
        )}
        {activeView === 'ollama' && <OllamaView models={models} refreshModels={refreshModels} />}
        {activeView === 'playground' && <PlaygroundView models={models} selectedModel={selectedModel} />}
        {activeView === 'history' && <HistoryView projectName={projectName} />}
      </main>
    </div>
  );
};

export default App;