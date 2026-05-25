import { useMindsparkStore } from '../store.js';
import { fetchFiles } from '../api.js';
import { useEffect } from 'react';

export function Toolbar() {
  const file = useMindsparkStore((s) => s.file);
  const files = useMindsparkStore((s) => s.files);
  const setFile = useMindsparkStore((s) => s.setFile);
  const setFiles = useMindsparkStore((s) => s.setFiles);
  const connected = useMindsparkStore((s) => s.connected);

  useEffect(() => {
    fetchFiles().then(setFiles);
  }, [setFiles]);

  return (
    <div className="toolbar">
      <span className="toolbar-title">Mindspark</span>
      <select value={file} onChange={(e) => setFile(e.target.value)}>
        {files.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? 'connected' : 'disconnected'}
      </span>
    </div>
  );
}
