import { describe, it, expect } from 'vitest';
import { parseMindmap } from '../../src/core/parser.js';

describe('parseMindmap', () => {
  it('parses simple markdown into tree', () => {
    const md = `# Root\n\n## Child A\n\n### Grandchild\n\n## Child B\n`;
    const tree = parseMindmap(md);

    expect(tree.title).toBe('Root');
    expect(tree.depth).toBe(1);
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].title).toBe('Child A');
    expect(tree.children[1].title).toBe('Child B');
  });

  it('extracts metadata from HTML comments', () => {
    const md = `# Root <!-- {"type":"root"} -->\n\n## Task <!-- {"type":"task","status":"done"} -->\n`;
    const tree = parseMindmap(md);

    expect(tree.meta).toEqual({ type: 'root' });
    expect(tree.children[0].meta).toEqual({ type: 'task', status: 'done' });
  });

  it('builds heading paths', () => {
    const md = `# A\n\n## B\n\n### C\n`;
    const tree = parseMindmap(md);

    expect(tree.path).toBe('A');
    expect(tree.children[0].path).toBe('A/B');
    expect(tree.children[0].children[0].path).toBe('A/B/C');
  });

  it('handles markdown without any headings', () => {
    const md = `Just some text.`;
    const tree = parseMindmap(md);

    expect(tree.title).toBe('');
    expect(tree.children).toHaveLength(0);
  });

  it('properly computes depth levels', () => {
    const md = `# L1\n\n## L2\n\n#### L4\n`;
    const tree = parseMindmap(md);

    expect(tree.depth).toBe(1);
    expect(tree.children[0].depth).toBe(2);
    expect(tree.children[0].children[0].depth).toBe(4);
  });
});
