import { Router, Request, Response } from 'express';
import { FileStore } from '../core/file-store.js';
import { parseMindmap, findNode, MindmapNode } from '../core/parser.js';
import { parseMeta, stripComment, writeMeta, mergeMeta, MetaRecord } from '../core/meta-manager.js';
import { toSnapshot } from '../core/snapshot.js';
import { WSManager } from './ws.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

interface HeadingInfo {
  lineIndex: number;
  depth: number;
  title: string;
  path: string;
}

/** Parse raw markdown and return a flat list of heading positions. */
function parseHeadings(markdown: string): HeadingInfo[] {
  const lines = markdown.split('\n');
  const headings: HeadingInfo[] = [];
  const pathStack: { title: string; depth: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s+(.+)/);
    if (!match) continue;

    const depth = match[1].length;
    const title = stripComment(match[2]);

    while (pathStack.length > 0 && pathStack[pathStack.length - 1].depth >= depth) {
      pathStack.pop();
    }

    pathStack.push({ title, depth });
    const path = pathStack.map((p) => p.title).join('/');

    headings.push({ lineIndex: i, depth, title, path });
  }

  return headings;
}

function findHeading(headings: HeadingInfo[], nodePath: string): HeadingInfo | null {
  return headings.find((h) => h.path === nodePath) ?? null;
}

/** Extract the node-path portion from a wildcard-capture value.
 *  Express may or may not decode wildcards; decodeURIComponent is always safe. */
function parseNodePath(raw: string): string {
  return decodeURIComponent(raw);
}

// ── Routes factory ───────────────────────────────────────────────────────────

export function createRoutes(store: FileStore, wsManager: WSManager): Router {
  const router = Router();

  // 1. GET /mindmaps — list .md files
  router.get('/mindmaps', async (_req: Request, res: Response) => {
    try {
      const files = await store.listFiles();
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /mindmaps/:file — raw MD content
  router.get('/mindmaps/:file', async (req: Request, res: Response) => {
    try {
      const file = req.params.file as string;
      if (!(await store.fileExists(file))) {
        return res.status(404).json({ error: 'File not found' });
      }
      const content = await store.readFile(file);
      res.type('text/plain').send(content);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /mindmaps/:file/tree — structured tree or snapshot text
  router.get('/mindmaps/:file/tree', async (req: Request, res: Response) => {
    try {
      const file = req.params.file as string;
      if (!(await store.fileExists(file))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const md = await store.readFile(file);
      const tree = parseMindmap(md);

      const metaParam = req.query.meta as string | undefined;
      const depthParam = req.query.depth as string | undefined;
      const pathParam = req.query.path as string | undefined;

      if (metaParam === 'false') {
        // Return snapshot text
        const snapshot = toSnapshot(tree, {
          includeMeta: false,
          depth: depthParam ? parseInt(depthParam, 10) : undefined,
          path: pathParam,
        });
        res.type('text/plain').send(snapshot);
      } else {
        // Return JSON tree (optionally filtered by path / depth)
        let root = tree;
        if (pathParam && typeof pathParam === 'string') {
          const found = findNode(tree, pathParam);
          if (!found) {
            return res.status(404).json({ error: 'Node not found at path' });
          }
          root = found;
        }

        if (depthParam) {
          const maxDepth = parseInt(depthParam as string, 10);
          const truncate = (n: MindmapNode, currentDepth: number): MindmapNode => {
            if (currentDepth >= maxDepth) return { ...n, children: [] };
            return { ...n, children: n.children.map((c) => truncate(c, currentDepth + 1)) };
          };
          root = truncate(root, 0);
        }

        res.json(root);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. POST /mindmaps/:file/nodes — add child node
  router.post('/mindmaps/:file/nodes', async (req: Request, res: Response) => {
    try {
      const file = req.params.file as string;
      if (!(await store.fileExists(file))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const { parent_path, title, meta } = req.body;
      if (!parent_path || !title) {
        return res.status(400).json({ error: 'parent_path and title are required' });
      }

      const md = await store.readFile(file);
      const tree = parseMindmap(md);
      const parent = findNode(tree, parent_path);
      if (!parent) {
        return res.status(404).json({ error: 'Parent node not found' });
      }

      const newDepth = parent.depth + 1;
      const hashes = '#'.repeat(newDepth);
      const metaObj: MetaRecord = meta || {};
      const metaStr = Object.keys(metaObj).length > 0 ? ` <!-- ${JSON.stringify(metaObj)} -->` : '';
      const newLine = `${hashes} ${title}${metaStr}`;

      // Append at end of file
      const lines = md.split('\n');
      if (lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(newLine);
      lines.push(''); // trailing newline
      await store.writeFile(file, lines.join('\n'));

      res.status(201).json({
        title,
        depth: newDepth,
        path: `${parent_path}/${title}`,
        meta: metaObj,
        body: '',
        children: [],
      });

      wsManager.broadcast({ type: 'node_added', file, parent_path, title });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. PUT /mindmaps/:file/nodes/* — update node  (title and/or meta)
  //    Also handles /mindmaps/:file/nodes/*/move when wildcard ends with /move
  router.put('/mindmaps/:file/nodes/*', async (req: Request, res: Response) => {
    try {
      const file = req.params.file as string;
      if (!(await store.fileExists(file))) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Express 4 wildcards are captured as req.params[0] (or via req.originalUrl fallback)
      const raw = getWildcard(req, file);
      if (raw === null) {
        return res.status(400).json({ error: 'Missing node path' });
      }

      // ── 7. Move operation ──────────────────────────────────────────────
      if (raw.endsWith('/move')) {
        const nodePath = parseNodePath(raw.slice(0, -5));
        const new_parent_path = req.body.new_parent_path;
        await handleMove(store, file, nodePath, req, res);
        wsManager.broadcast({ type: 'node_moved', file, path: nodePath, new_parent_path });
        return;
      }

      // ── 5. Update operation ────────────────────────────────────────────
      const nodePath = parseNodePath(raw);
      const md = await store.readFile(file);
      const headings = parseHeadings(md);
      const info = findHeading(headings, nodePath);
      if (!info) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const lines = md.split('\n');
      let line = lines[info.lineIndex];
      const existingMeta = parseMeta(line);
      const { title: newTitle, meta: newMeta } = req.body;

      if (newTitle) {
        const headingMatch = line.match(/^(#+)\s+/);
        const prefix = headingMatch ? headingMatch[0] : '# ';
        // Preserve existing meta comment text
        const commentIdx = line.indexOf('<!--');
        // Build new line with new title + existing or new meta
        if (newMeta) {
          const merged = mergeMeta(existingMeta, newMeta);
          line = `${prefix}${newTitle} <!-- ${JSON.stringify(merged)} -->`;
        } else if (commentIdx !== -1) {
          // Keep existing comment
          const comment = line.slice(commentIdx);
          line = `${prefix}${newTitle} ${comment}`;
        } else {
          line = `${prefix}${newTitle}`;
        }
      } else if (newMeta) {
        const merged = mergeMeta(existingMeta, newMeta);
        line = writeMeta(line, merged);
      }

      lines[info.lineIndex] = line;
      await store.writeFile(file, lines.join('\n'));

      // Return updated node
      const updatedMd = await store.readFile(file);
      const updatedTree = parseMindmap(updatedMd);
      const updatedNode = findNode(updatedTree, nodePath);

      res.json(updatedNode);

      wsManager.broadcast({ type: 'node_updated', file, path: nodePath, changes: newMeta ?? {} });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. DELETE /mindmaps/:file/nodes/* — delete node + subtree
  router.delete('/mindmaps/:file/nodes/*', async (req: Request, res: Response) => {
    try {
      const file = req.params.file as string;
      if (!(await store.fileExists(file))) {
        return res.status(404).json({ error: 'File not found' });
      }

      const raw = getWildcard(req, file);
      if (raw === null) {
        return res.status(400).json({ error: 'Missing node path' });
      }

      const nodePath = parseNodePath(raw);
      const md = await store.readFile(file);
      const headings = parseHeadings(md);
      const info = findHeading(headings, nodePath);
      if (!info) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const lines = md.split('\n');
      const startLine = info.lineIndex;

      // Find end: the next heading at same or higher level (smaller or equal depth)
      let endLine = lines.length;
      for (const h of headings) {
        if (h.lineIndex > startLine && h.depth <= info.depth) {
          endLine = h.lineIndex;
          break;
        }
      }

      // Remove the subtree lines
      const before = lines.slice(0, startLine);
      // Clean up trailing blank lines
      while (before.length > 0 && before[before.length - 1].trim() === '') {
        before.pop();
      }
      const after = lines.slice(endLine);

      const result = [...before, ...after];
      await store.writeFile(file, result.join('\n'));

      res.json({ success: true });

      wsManager.broadcast({ type: 'node_deleted', file, path: nodePath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ── Move helper ──────────────────────────────────────────────────────────────

async function handleMove(
  store: FileStore,
  file: string,
  nodePath: string,
  req: Request,
  res: Response,
): Promise<void> {
  const { new_parent_path } = req.body;
  if (!new_parent_path) {
    res.status(400).json({ error: 'new_parent_path is required' });
    return;
  }

  const md = await store.readFile(file);
  const tree = parseMindmap(md);
  const node = findNode(tree, nodePath);
  if (!node) {
    res.status(404).json({ error: 'Source node not found' });
    return;
  }
  const newParent = findNode(tree, new_parent_path);
  if (!newParent) {
    res.status(404).json({ error: 'Target parent not found' });
    return;
  }

  const headings = parseHeadings(md);
  const srcInfo = findHeading(headings, nodePath);
  const dstInfo = findHeading(headings, new_parent_path);
  if (!srcInfo || !dstInfo) {
    res.status(404).json({ error: 'Heading not found' });
    return;
  }

  const lines = md.split('\n');

  // 1. Extract subtree lines
  const startLine = srcInfo.lineIndex;
  let endLine = lines.length;
  for (const h of headings) {
    if (h.lineIndex > startLine && h.depth <= srcInfo.depth) {
      endLine = h.lineIndex;
      break;
    }
  }
  const subtreeLines = lines.slice(startLine, endLine);

  // 2. Remove subtree from original location
  let before = lines.slice(0, startLine);
  while (before.length > 0 && before[before.length - 1].trim() === '') {
    before.pop();
  }
  const after = lines.slice(endLine);
  let remainder = [...before];
  if (remainder.length > 0) {
    remainder.push('');
  }
  remainder = [...remainder, ...after];

  // 3. Re-level headings
  const depthDiff = dstInfo.depth + 1 - srcInfo.depth;
  const reLeveled = subtreeLines.map((l) => {
    const m = l.match(/^(#+)\s/);
    if (m) {
      const newHashes = '#'.repeat(m[1].length + depthDiff);
      return l.replace(/^(#+)\s/, `${newHashes} `);
    }
    return l;
  });

  // 4. Re-parse remainder to find insertion point
  const remainderText = remainder.join('\n');
  const newHeadings = parseHeadings(remainderText);
  const dstNewInfo = findHeading(newHeadings, new_parent_path);
  if (!dstNewInfo) {
    res.status(404).json({ error: 'Target parent not found after removal' });
    return;
  }

  // Find end of new parent's subtree
  let insertAfter = dstNewInfo.lineIndex;
  for (const h of newHeadings) {
    if (h.lineIndex > dstNewInfo.lineIndex && h.depth <= dstInfo.depth) {
      break;
    }
    insertAfter = h.lineIndex;
  }
  // If parent has no children, insert right after the parent heading
  if (insertAfter === dstNewInfo.lineIndex) {
    // Scan forward past any blank lines / body text under the heading
    const remLines = remainder;
    insertAfter = dstNewInfo.lineIndex;
    for (let i = dstNewInfo.lineIndex + 1; i < remLines.length; i++) {
      if (remLines[i].match(/^(#+)\s/)) break;
      insertAfter = i;
    }
  }

  // 5. Insert re-leveled subtree
  const insBefore = remainder.slice(0, insertAfter + 1);
  while (insBefore.length > 0 && insBefore[insBefore.length - 1].trim() === '') {
    insBefore.pop();
  }
  const insAfter = remainder.slice(insertAfter + 1);

  const result = [...insBefore, '', ...reLeveled, ...insAfter];
  await store.writeFile(file, result.join('\n'));

  // Return the moved node
  const finalMd = await store.readFile(file);
  const finalTree = parseMindmap(finalMd);
  const movedNode = findNode(finalTree, `${new_parent_path}/${node.title}`);
  res.json(movedNode);
}

// ── Express 4 wildcard extraction ────────────────────────────────────────────

/** Extract the wildcard path segment(s) from the request.
 *  In Express 4 the splat param is stored at `req.params[0]`.
 *  If that is empty/undefined we fall back to parsing `req.path`
 *  (the path relative to the router mount point — this router is
 *  mounted at `/api`, so `req.path` looks like `/mindmaps/:file/nodes/...`). */
function getWildcard(req: Request, file: string): string | null {
  // Express 4 puts * captures in req.params[0]
  const splat = (req.params as any)[0] as string | undefined;
  if (splat !== undefined && splat !== '') return splat;

  // Fallback: parse req.path
  const prefix = `/mindmaps/${file}/nodes/`;
  if (req.path.startsWith(prefix)) {
    return req.path.slice(prefix.length);
  }

  return null;
}
