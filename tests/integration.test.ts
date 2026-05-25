import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createTmpWorkspace } from './helpers/tmp-workspace.js';
import { FileStore } from '../src/core/file-store.js';
import { createApp } from '../src/api/server.js';
import type { AddressInfo } from 'node:net';

describe('Integration', () => {
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd('project.md', '# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature","status":"active"} -->\n### Task <!-- {"type":"task","status":"done","ai_hint":"test"} -->\n');
    const store = new FileStore(ws.dir);
    const created = createApp(store);
    server = created.server;
    server.listen(0);
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await ws.cleanup();
  });

  async function fetchApi(path: string, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, init);
  }

  it('full CRUD cycle', async () => {
    // List files
    const listRes = await fetchApi('/api/mindmaps');
    expect((await listRes.json())).toContain('project.md');

    // Read snapshot
    const readRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const text = await readRes.text();
    expect(text).toContain('Root');
    expect(text).toContain('Feature');
    expect(text).toContain('Task');

    // Add node
    const addRes = await fetchApi('/api/mindmaps/project.md/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path: 'Root', title: 'New Feature', meta: { type: 'feature', status: 'pending' } }),
    });
    expect(addRes.status).toBe(201);

    // Update node
    const updateRes = await fetchApi('/api/mindmaps/project.md/nodes/Root/New%20Feature', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { status: 'in_progress', priority: 1 } }),
    });
    expect(updateRes.status).toBe(200);

    // Read updated snapshot
    const verifyRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const verifyText = await verifyRes.text();
    expect(verifyText).toContain('New Feature');

    // Delete node
    const deleteRes = await fetchApi('/api/mindmaps/project.md/nodes/Root/New%20Feature', { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const finalRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const finalText = await finalRes.text();
    expect(finalText).not.toContain('New Feature');
  });
});
