import { Transformer } from 'markmap-lib';
import { parseMeta, stripComment, MetaRecord } from './meta-manager.js';

export interface MindmapNode {
  title: string;
  depth: number;
  path: string;
  meta: MetaRecord;
  body: string;
  children: MindmapNode[];
}

const transformer = new Transformer();

export function parseMindmap(markdown: string): MindmapNode {
  const { root: markmapRoot } = transformer.transform(markdown);

  function buildTree(node: any, parentPath: string = ''): MindmapNode {
    const rawContent: string = node.content ?? '';
    const title = stripComment(rawContent);
    const depth = tagToDepth(node.payload?.tag);
    const path = parentPath ? `${parentPath}/${title}` : title;
    const meta = parseMeta(rawContent);

    let body = '';
    if (node.payload?.lines) {
      body = extractBody(node, markdown);
    }

    const children: MindmapNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        children.push(buildTree(child, path || ''));
      }
    }

    return { title, depth, path, meta, body, children };
  }

  return buildTree(markmapRoot);
}

function tagToDepth(tag?: string): number {
  if (!tag) return 0;
  const match = tag.match(/^h(\d)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function extractBody(_node: any, _markdown: string): string {
  // Simplified v1: body extraction requires deeper markmap-lib integration.
  // Returns empty string for now — body rendering works via snapshot include_body flag.
  return '';
}

export function findNode(tree: MindmapNode, path: string): MindmapNode | null {
  if (tree.path === path) return tree;
  for (const child of tree.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}

export function flattenTree(tree: MindmapNode): MindmapNode[] {
  return [tree, ...tree.children.flatMap(flattenTree)];
}
