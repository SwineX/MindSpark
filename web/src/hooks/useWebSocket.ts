import { useEffect, useRef } from 'react';
import { useMindsparkStore } from '../store.js';
import type { WSEvent } from '../types.js';
import { fetchFile } from '../api.js';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const setConnected = useMindsparkStore((s) => s.setConnected);
  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data: WSEvent = JSON.parse(event.data);
      if (data.file === file || !data.file) {
        fetchFile(file).then(setMdContent);
      }
    };

    return () => ws.close();
  }, [file, setConnected, setMdContent]);
}
