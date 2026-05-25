import { MindmapNode, findNode } from './parser.js';

export interface SnapshotOptions {
  includeMeta?: boolean;
  includeBody?: boolean;
  depth?: number;
  path?: string;
}

export function toSnapshot(tree: MindmapNode, options: SnapshotOptions = {}): string {
  const { includeMeta = true, includeBody = false, depth, path } = options;

  let root = tree;
  if (path) {
    const found = findNode(tree, path);
    if (!found) return '';
    root = found;
  }

  const lines: string[] = [];
  renderNode(root, 0, depth ?? Infinity, includeMeta, includeBody, lines);
  return lines.join('\n');
}

function renderNode(
  node: MindmapNode,
  currentDepth: number,
  maxDepth: number,
  includeMeta: boolean,
  includeBody: boolean,
  lines: string[],
): void {
  if (currentDepth > maxDepth) return;

  const indent = '  '.repeat(currentDepth);
  let line = `${indent}${node.title}`;

  if (includeMeta && Object.keys(node.meta).length > 0) {
    line += ` ${JSON.stringify(node.meta)}`;
  } else if (includeMeta) {
    line += ` {}`;
  }

  lines.push(line);

  if (includeBody && node.body) {
    const bodyLines = node.body.split('\n').filter((l) => l.trim());
    for (const bodyLine of bodyLines.slice(0, 5)) {
      const truncated = bodyLine.length > 200 ? bodyLine.slice(0, 200) + '...' : bodyLine;
      lines.push(`${indent}  | ${truncated}`);
    }
  }

  for (const child of node.children) {
    renderNode(child, currentDepth + 1, maxDepth, includeMeta, includeBody, lines);
  }
}
