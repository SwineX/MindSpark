import { FileStore } from '../core/file-store.js';
import { parseMindmap, findNode } from '../core/parser.js';
import { toSnapshot } from '../core/snapshot.js';
import { writeMeta, mergeMeta } from '../core/meta-manager.js';
import { generatePreviewHTML } from '../preview/renderer.js';

export function createToolHandlers(store: FileStore) {
  return {
    async list_mindmaps(_params: Record<string, unknown>) {
      const files = await store.listFiles();
      return { files };
    },

    async read_mindmap(params: { file: string; path?: string; depth?: number; include_meta?: boolean; include_body?: boolean; follow_links?: boolean }) {
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);

      const content = toSnapshot(tree, {
        includeMeta: params.include_meta ?? true,
        includeBody: params.include_body ?? false,
        depth: params.depth,
        path: params.path,
      });

      return { content, file: params.file };
    },

    async add_node(params: { file: string; parent_path: string; title: string; meta?: Record<string, unknown>; body?: string }) {
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);
      const parent = params.parent_path ? findNode(tree, params.parent_path) : tree;
      if (!parent) throw new Error(`Parent path not found: ${params.parent_path}`);

      const newDepth = parent.depth + 1;
      const hashes = '#'.repeat(newDepth);
      const metaStr = params.meta && Object.keys(params.meta).length > 0 ? ` <!-- ${JSON.stringify(params.meta)} -->` : '';
      const bodyStr = params.body ? `\n\n${params.body}` : '';

      const newMd = md.trimEnd() + `\n\n${hashes} ${params.title}${metaStr}${bodyStr}\n`;
      await store.writeFile(params.file, newMd);

      return { added: params.title, parent: params.parent_path };
    },

    async update_node(params: { file: string; path: string; title?: string; meta?: Record<string, unknown>; body?: string }) {
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);
      const node = findNode(tree, params.path);
      if (!node) throw new Error(`Node not found: ${params.path}`);

      const lines = md.split('\n');
      // Build a heading index from the raw markdown
      const headings = parseHeadings(md);
      const entry = headings.find(h => h.path === params.path);
      if (!entry) throw new Error(`Heading line not found: ${params.path}`);

      if (params.title) {
        const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
        const newHeading = `${'#'.repeat(node.depth)} ${params.title}`;
        lines[entry.lineIndex] = lines[entry.lineIndex].replace(oldHeading, newHeading);
      }
      if (params.meta) {
        // Pass the full line (with heading markers) so writeMeta can detect the correct depth
        lines[entry.lineIndex] = writeMeta(lines[entry.lineIndex], mergeMeta(node.meta, params.meta));
      }

      await store.writeFile(params.file, lines.join('\n'));
      return { updated: params.path };
    },

    async delete_node(params: { file: string; path: string }) {
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);
      const node = findNode(tree, params.path);
      if (!node) throw new Error(`Node not found: ${params.path}`);

      const lines = md.split('\n');
      const headings = parseHeadings(md);
      const entry = headings.find(h => h.path === params.path);
      if (!entry) throw new Error(`Heading line not found: ${params.path}`);

      // Find end: next heading at same or higher level
      let endIdx = lines.length;
      for (let i = entry.lineIndex + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= entry.depth) { endIdx = i; break; }
      }
      lines.splice(entry.lineIndex, endIdx - entry.lineIndex);

      await store.writeFile(params.file, lines.join('\n'));
      return { deleted: params.path };
    },

    async move_node(params: { file: string; path: string; new_parent_path: string; position?: number }) {
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);
      const node = findNode(tree, params.path);
      const newParent = findNode(tree, params.new_parent_path);
      if (!node || !newParent) throw new Error('Node or target not found');

      const lines = md.split('\n');
      const headings = parseHeadings(md);
      const entry = headings.find(h => h.path === params.path);
      if (!entry) throw new Error(`Heading line not found: ${params.path}`);

      // Extract the subtree
      let endIdx = lines.length;
      for (let i = entry.lineIndex + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= entry.depth) { endIdx = i; break; }
      }
      const extracted = lines.slice(entry.lineIndex, endIdx);
      lines.splice(entry.lineIndex, endIdx - entry.lineIndex);

      // Re-level
      const depthDiff = entry.depth - (newParent.depth + 1);
      const reLeveled = extracted.map((line) => {
        const m = line.match(/^(#+)/);
        if (!m) return line;
        const currentDepth = m[1].length;
        const newDepthVal = Math.max(1, currentDepth - depthDiff);
        return '#'.repeat(newDepthVal) + line.slice(currentDepth);
      });

      const result = lines.join('\n').trimEnd() + '\n' + reLeveled.join('\n') + '\n';
      await store.writeFile(params.file, result);

      return { moved: params.path, to: params.new_parent_path };
    },

    async preview(params: { file: string; open?: boolean }) {
      const md = await store.readFile(params.file);
      const html = generatePreviewHTML(md, params.file);
      return { html, file: params.file, previewGenerated: true };
    },
  };
}

// Helper: parse headings from raw markdown (line-level index for edits)
function parseHeadings(md: string): Array<{lineIndex: number; depth: number; title: string; path: string}> {
  const lines = md.split('\n');
  const result: Array<{lineIndex: number; depth: number; title: string; path: string}> = [];
  const pathStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s+(.+)/);
    if (m) {
      const depth = m[1].length;
      const rawTitle = m[2];
      // Strip HTML comment if present
      const title = rawTitle.replace(/\s*<!--.*?-->\s*$/, '').trim();

      // Maintain path stack
      while (pathStack.length >= depth) pathStack.pop();
      pathStack.push(title);
      const path = pathStack.join('/');

      result.push({ lineIndex: i, depth, title, path });
    }
  }

  return result;
}
