import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../../src/api/server.js';
import { FileStore } from '../../src/core/file-store.js';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import type { AddressInfo } from 'node:net';

describe('REST API', () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let baseUrl: string;
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd(
      'test.md',
      '# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature"} -->\n',
    );
    await ws.writeMd('empty.md', '# Empty');

    const store = new FileStore(ws.dir);
    app = createApp(store);
    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    server.close();
    await ws.cleanup();
  });

  async function fetchApi(path: string, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, init);
  }

  it('GET /api/mindmaps lists files', async () => {
    const res = await fetchApi('/api/mindmaps');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toContain('test.md');
    expect(data).toContain('empty.md');
  });

  it('GET /api/mindmaps/:file returns raw content', async () => {
    const res = await fetchApi('/api/mindmaps/test.md');
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('# Root');
    expect(text).toContain('## Feature');
  });

  it('GET /api/mindmaps/:file/tree returns structured tree', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/tree?meta=true');
    const data = await res.json();
    expect(data.title).toBe('Root');
    expect(data.meta.type).toBe('root');
    expect(data.children).toHaveLength(1);
  });

  it('POST /api/mindmaps/:file/nodes adds a child node', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path: 'Root', title: 'New Node', meta: { type: 'task' } }),
    });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.title).toBe('New Node');
    expect(data.meta.type).toBe('task');
  });

  it('PUT /api/mindmaps/:file/nodes/:path updates metadata', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes/Root', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { status: 'active' } }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.meta.status).toBe('active');
  });

  it('DELETE /api/mindmaps/:file/nodes/:path deletes node', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes/Root/New%20Node', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent file', async () => {
    const res = await fetchApi('/api/mindmaps/nope.md');
    expect(res.status).toBe(404);
  });
});
