import { describe, it, expect } from 'vitest';
import { parseMeta, writeMeta, mergeMeta } from '../../src/core/meta-manager.js';

describe('parseMeta', () => {
  it('extracts JSON from HTML comment on heading line', () => {
    const line = '## Login <!-- {"type":"task","status":"done"} -->';
    const result = parseMeta(line);
    expect(result).toEqual({ type: 'task', status: 'done' });
  });

  it('returns empty object when no comment', () => {
    const line = '## Plain heading';
    const result = parseMeta(line);
    expect(result).toEqual({});
  });

  it('handles multi-line content before comment', () => {
    const line = '# Root <!-- {"type":"root"} -->';
    const result = parseMeta(line);
    expect(result).toEqual({ type: 'root' });
  });

  it('handles empty comment', () => {
    const line = '## X <!-- -->';
    const result = parseMeta(line);
    expect(result).toEqual({});
  });

  it('handles malformed JSON gracefully', () => {
    const line = '## X <!-- {bad json} -->';
    const result = parseMeta(line);
    expect(result).toEqual({});
  });
});

describe('writeMeta', () => {
  it('adds meta comment to heading without existing comment', () => {
    const result = writeMeta('Login', { type: 'task', status: 'done' });
    // Default depth is 2 (##) for titles without heading markers
    expect(result).toBe('## Login <!-- {"type":"task","status":"done"} -->');
  });

  it('replaces existing meta comment', () => {
    const result = writeMeta('## Login <!-- {"type":"task","status":"pending"} -->', { type: 'task', status: 'done' });
    expect(result).toBe('## Login <!-- {"type":"task","status":"done"} -->');
  });

  it('handles heading with inline markdown', () => {
    const result = writeMeta('📎 [Link](./file.md)', { type: 'link', target: './file.md' });
    // Default depth is 2 (##) for titles without heading markers
    expect(result).toBe('## 📎 [Link](./file.md) <!-- {"type":"link","target":"./file.md"} -->');
  });
});

describe('mergeMeta', () => {
  it('merges new keys into existing meta', () => {
    const result = mergeMeta({ type: 'task', status: 'pending' }, { status: 'done' });
    expect(result).toEqual({ type: 'task', status: 'done' });
  });

  it('adds new keys', () => {
    const result = mergeMeta({ type: 'task' }, { status: 'in_progress', priority: 1 });
    expect(result).toEqual({ type: 'task', status: 'in_progress', priority: 1 });
  });

  it('removes keys set to null', () => {
    const result = mergeMeta({ type: 'task', ai_hint: 'old hint', status: 'pending' }, { ai_hint: null });
    expect(result).toEqual({ type: 'task', status: 'pending' });
  });

  it('returns new meta when old is empty', () => {
    const result = mergeMeta({}, { type: 'feature' });
    expect(result).toEqual({ type: 'feature' });
  });
});
