import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar.js';
import { MarkmapView } from './components/MarkmapView.js';
import { MetaPanel } from './components/MetaPanel.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useMindsparkStore } from './store.js';
import { fetchFile, fetchFiles } from './api.js';
import './App.css';

export default function App() {
  useWebSocket();

  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);
  const setFiles = useMindsparkStore((s) => s.setFiles);

  useEffect(() => {
    fetchFile(file).then(setMdContent);
    fetchFiles().then(setFiles);
  }, [file, setMdContent, setFiles]);

  return (
    <div className="app">
      <Toolbar />
      <div className="main-area">
        <MarkmapView />
        <MetaPanel />
      </div>
    </div>
  );
}
