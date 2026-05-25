const BASE = '/api';

export async function fetchFiles(): Promise<string[]> {
  const res = await fetch(`${BASE}/mindmaps`);
  return res.json();
}

export async function fetchFile(file: string): Promise<string> {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}`);
  return res.text();
}

export async function addNode(file: string, parent_path: string, title: string, meta?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_path, title, meta }),
  });
  return res.json();
}

export async function updateNode(file: string, path: string, updates: { title?: string; meta?: Record<string, unknown> }) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteNode(file: string, path: string) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  return res.json();
}
