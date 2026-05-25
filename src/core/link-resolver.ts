import { FileStore } from './file-store.js';
import { parseMindmap, MindmapNode } from './parser.js';

export class LinkResolver {
  constructor(private store: FileStore) {}

  async resolveLink(target: string, visited: Set<string> = new Set()): Promise<MindmapNode | null> {
    if (visited.has(target)) return null;

    const normalized = target.replace(/^\.\/?/, '');
    if (!(await this.store.fileExists(normalized))) return null;

    const md = await this.store.readFile(normalized);
    const tree = parseMindmap(md);

    visited.add(normalized);
    return tree;
  }

  /** Inline linked documents as children of link nodes, with recursion protection */
  async expandLinks(tree: MindmapNode, visited: Set<string> = new Set()): Promise<MindmapNode> {
    const expanded = { ...tree, children: [...tree.children] };

    for (let i = 0; i < expanded.children.length; i++) {
      const child = expanded.children[i];
      if (child.meta.type === 'link' && child.meta.target && typeof child.meta.target === 'string') {
        const resolved = await this.resolveLink(child.meta.target, visited);
        if (resolved) {
          expanded.children[i] = { ...child, children: resolved.children };
        }
      } else {
        expanded.children[i] = await this.expandLinks(child, visited);
      }
    }

    return expanded;
  }
}
