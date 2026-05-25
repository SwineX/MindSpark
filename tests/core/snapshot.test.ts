import { describe, it, expect } from 'vitest';
import { toSnapshot } from '../../src/core/snapshot.js';
import { parseMindmap } from '../../src/core/parser.js';

describe('toSnapshot', () => {
  const md = '# Root <!-- {"type":"root"} -->\n\n## Features <!-- {"type":"feature","status":"active"} -->\n\n### Login <!-- {"type":"task","status":"done","ai_hint":"JWT"} -->\n\n## Tests <!-- {"type":"test_suite"} -->';

  it('renders flat indented text with meta', () => {
    const tree = parseMindmap(md);
    const output = toSnapshot(tree, { includeMeta: true });

    const lines = output.split('\n');
    expect(lines[0]).toContain('Root');
    expect(lines[0]).toContain('{"type":"root"}');
    expect(lines[1]).toContain('  Features');
    expect(lines[1]).toContain('{"type":"feature","status":"active"}');
    expect(lines[2]).toContain('    Login');
    expect(lines[2]).toContain('"ai_hint":"JWT"');
  });

  it('renders without meta when includeMeta is false', () => {
    const tree = parseMindmap(md);
    const output = toSnapshot(tree, { includeMeta: false });

    expect(output).not.toContain('{');
    expect(output).toContain('Root');
    expect(output).toContain('  Features');
  });

  it('respects depth limit', () => {
    const tree = parseMindmap(md);
    const output = toSnapshot(tree, { depth: 1, includeMeta: true });
    const lines = output.split('\n');

    expect(lines).toHaveLength(3); // Root + 2 children at depth 1
    expect(lines[0]).toContain('Root');
    expect(lines[1]).toContain('Features');
    expect(lines[2]).toContain('Tests');
    expect(output).not.toContain('Login');
  });

  it('respects path filter', () => {
    const tree = parseMindmap(md);
    const output = toSnapshot(tree, { path: 'Root/Features', includeMeta: true });
    const lines = output.split('\n');

    expect(lines[0]).toContain('Features');
    expect(lines[1]).toContain('Login');
    expect(output).not.toContain('Tests');
  });

  it('handles empty tree', () => {
    const tree = parseMindmap('# Root');
    const output = toSnapshot(tree, { includeMeta: true });

    expect(output).toBe('Root {}');
  });
});
