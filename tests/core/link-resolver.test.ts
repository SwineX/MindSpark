import { describe, it, expect } from 'vitest';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import { LinkResolver } from '../../src/core/link-resolver.js';
import { FileStore } from '../../src/core/file-store.js';

describe('LinkResolver', () => {
  it('resolves a link node to its target file content', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('parent.md', '# Parent\n\n## Link <!-- {"type":"link","target":"child.md"} -->');
    await ws.writeMd('child.md', '# Child\n\n## Section\n');

    const store = new FileStore(ws.dir);
    const resolver = new LinkResolver(store);
    const resolved = await resolver.resolveLink('child.md');

    expect(resolved).not.toBeNull();
    expect(resolved!.title).toBe('Child');

    await ws.cleanup();
  });

  it('prevents recursive link resolution', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('a.md', '# A\n\n## Link <!-- {"type":"link","target":"b.md"} -->');
    await ws.writeMd('b.md', '# B\n\n## Link <!-- {"type":"link","target":"a.md"} -->');

    const store = new FileStore(ws.dir);
    const resolver = new LinkResolver(store);

    // Should not stack overflow
    const resolved = await resolver.resolveLink('b.md', new Set(['a.md']));
    expect(resolved).not.toBeNull();

    await ws.cleanup();
  });

  it('returns null for non-existent target', async () => {
    const ws = await createTmpWorkspace();
    const store = new FileStore(ws.dir);
    const resolver = new LinkResolver(store);

    const resolved = await resolver.resolveLink('nonexistent.md');
    expect(resolved).toBeNull();

    await ws.cleanup();
  });
});
