import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import { FileStore } from '../../src/core/file-store.js';
import { createToolHandlers } from '../../src/mcp/tools.js';

describe('MCP Tools', () => {
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;
  let store: FileStore;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd('test.md', '# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature","status":"active"} -->\n### Task <!-- {"type":"task","status":"done","ai_hint":"test"} -->\n');
    await ws.writeMd('empty.md', '');
    store = new FileStore(ws.dir);
    handlers = createToolHandlers(store);
  });

  afterAll(async () => { await ws.cleanup(); });

  it('list_mindmaps returns all .md files', async () => {
    const result = await handlers.list_mindmaps({});
    expect(result.files).toContain('test.md');
  });

  it('read_mindmap returns flat snapshot text', async () => {
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('Root');
    expect(result.content).toContain('{"type":"root"}');
  });

  it('read_mindmap respects depth', async () => {
    const result = await handlers.read_mindmap({ file: 'test.md', depth: 1, include_meta: false });
    const lines = result.content.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('add_node creates a new heading', async () => {
    await handlers.add_node({ file: 'test.md', parent_path: 'Root', title: 'New Node', meta: { type: 'feature' } });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('New Node');
  });

  it('update_node merges metadata', async () => {
    await handlers.update_node({ file: 'test.md', path: 'Root/Feature', meta: { status: 'done' } });
    const result = await handlers.read_mindmap({ file: 'test.md', path: 'Root/Feature', include_meta: true });
    expect(result.content).toContain('"status":"done"');
  });

  it('delete_node removes a heading', async () => {
    await handlers.delete_node({ file: 'test.md', path: 'Root/New Node' });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).not.toContain('New Node');
  });

  it('move_node relocates a subtree', async () => {
    await handlers.move_node({ file: 'test.md', path: 'Root/Feature/Task', new_parent_path: 'Root' });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('Task');
  });
});
