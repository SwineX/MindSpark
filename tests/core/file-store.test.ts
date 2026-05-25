import { describe, it, expect } from 'vitest';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import { FileStore } from '../../src/core/file-store.js';

describe('FileStore', () => {
  it('lists all .md files in workspace', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('a.md', '# A');
    await ws.writeMd('b.md', '# B');
    await ws.writeMd('notes.txt', 'not md');

    const store = new FileStore(ws.dir);
    const files = await store.listFiles();

    expect(files).toEqual(['a.md', 'b.md']);

    await ws.cleanup();
  });

  it('reads file content', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('test.md', '# Hello\n\nWorld');

    const store = new FileStore(ws.dir);
    const content = await store.readFile('test.md');

    expect(content).toBe('# Hello\n\nWorld');

    await ws.cleanup();
  });

  it('writes file atomically', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('test.md', 'original');

    const store = new FileStore(ws.dir);
    await store.writeFile('test.md', 'updated');

    const content = await store.readFile('test.md');
    expect(content).toBe('updated');

    await ws.cleanup();
  });

  it('throws on non-existent file', async () => {
    const ws = await createTmpWorkspace();
    const store = new FileStore(ws.dir);

    await expect(store.readFile('nonexistent.md')).rejects.toThrow();

    await ws.cleanup();
  });

  it('writes new file creating parent dirs', async () => {
    const ws = await createTmpWorkspace();
    const store = new FileStore(ws.dir);

    await store.writeFile('sub/deep/file.md', '# Deep');
    const content = await store.readFile('sub/deep/file.md');

    expect(content).toBe('# Deep');

    await ws.cleanup();
  });

  it('deleteFile removes a file', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('to-delete.md', '# Bye');
    const store = new FileStore(ws.dir);

    await store.deleteFile('to-delete.md');

    const exists = await store.fileExists('to-delete.md');
    expect(exists).toBe(false);

    await ws.cleanup();
  });

  it('deleteFile on non-existent file throws', async () => {
    const ws = await createTmpWorkspace();
    const store = new FileStore(ws.dir);

    await expect(store.deleteFile('nonexistent.md')).rejects.toThrow();

    await ws.cleanup();
  });

  it('fileExists returns true/false correctly', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('existing.md', '# Here');
    const store = new FileStore(ws.dir);

    const yes = await store.fileExists('existing.md');
    const no = await store.fileExists('missing.md');

    expect(yes).toBe(true);
    expect(no).toBe(false);

    await ws.cleanup();
  });

  it('rejects path traversal attempts', async () => {
    const ws = await createTmpWorkspace();
    const store = new FileStore(ws.dir);

    await expect(store.readFile('../outside.md')).rejects.toThrow(
      /Path traversal/,
    );

    await ws.cleanup();
  });
});
