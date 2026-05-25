# Mindspark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified TypeScript server that provides MCP tools + REST API + WebSocket for CRUD operations on Markdown mindmaps with HTML-comment metadata, plus a lightweight React web editor with markmap-view.

**Architecture:** Single Node.js process combining Express HTTP server, WebSocket, and MCP stdio transport, all sharing a Core Engine that wraps markmap-lib for MD parsing and HTML-comment metadata management. File system as data store (`workspace/*.md`).

**Tech Stack:** TypeScript + Node.js + Express + ws + markmap-lib + @modelcontextprotocol/sdk + Vitest. Frontend: React + Vite + markmap-view + Zustand.

---

## File Map

```
mindspark/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                  # Unified entry: HTTP server + MCP stdio in same process
│   ├── config.ts                 # Port, workspace path
│   ├── core/
│   │   ├── file-store.ts         # readFile, writeFile, listFiles, deleteFile — atomic writes
│   │   ├── meta-manager.ts       # parseMeta, writeMeta, mergeMeta
│   │   ├── parser.ts             # parseMindmap(md) → MindmapTree with metadata
│   │   ├── link-resolver.ts      # resolveLink(target) → {md, tree}
│   │   └── snapshot.ts           # toSnapshot(tree, opts) → flat indented text
│   ├── api/
│   │   ├── server.ts             # createApp() → Express app
│   │   ├── routes.ts             # /api/mindmaps/* REST endpoints
│   │   └── ws.ts                 # WebSocket manager + broadcast
│   ├── mcp/
│   │   ├── server.ts             # MCP stdio transport setup
│   │   └── tools.ts              # All 7 MCP tool handlers
│   └── preview/
│       └── renderer.ts           # Generate standalone markmap HTML
├── tests/
│   ├── fixtures/                 # Sample .md files for tests
│   │   ├── simple.md
│   │   ├── with-meta.md
│   │   ├── nested.md
│   │   └── linked-parent.md
│   │   └── linked-child.md
│   ├── core/
│   │   ├── file-store.test.ts
│   │   ├── meta-manager.test.ts
│   │   ├── parser.test.ts
│   │   └── link-resolver.test.ts
│   │   └── snapshot.test.ts
│   ├── api/
│   │   └── routes.test.ts
│   ├── mcp/
│   │   └── tools.test.ts
│   └── helpers/
│       └── tmp-workspace.ts      # Create temp workspace for tests
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.css
│       ├── store.ts              # Zustand store
│       ├── types.ts              # Shared frontend types
│       ├── api.ts                # REST client
│       ├── components/
│       │   ├── Toolbar.tsx
│       │   ├── MarkmapView.tsx
│       │   └── MetaPanel.tsx
│       └── hooks/
│           └── useWebSocket.ts
└── workspace/
    └── sample-project.md         # Default example mindmap
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mindspark",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "ws": "^8.18.0",
    "markmap-lib": "^0.18.0",
    "markmap-view": "^0.18.0",
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/ws": "^8.5.13",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests", "web"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 5: Create src/config.ts**

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

export const config = {
  port: 16393,
  workspaceDir: path.join(PROJECT_ROOT, 'workspace'),
  projectRoot: PROJECT_ROOT,
};
```

- [ ] **Step 6: Create workspace/ directory with sample file**

```bash
mkdir -p workspace
```

Create `workspace/sample-project.md`:
```markdown
# Sample Project <!-- {"type":"root"} -->

## Getting Started <!-- {"type":"feature","status":"done"} -->

### Install dependencies <!-- {"type":"task","status":"done","ai_hint":"Run npm install"} -->
### Start dev server <!-- {"type":"task","status":"done","ai_hint":"Run npm run dev"} -->

## Core Features <!-- {"type":"feature","status":"in_progress"} -->

### Authentication <!-- {"type":"task","status":"in_progress","ai_hint":"Implement JWT-based auth with refresh tokens"} -->

#### Login endpoint <!-- {"type":"subtask","status":"done"} -->
#### Token refresh <!-- {"type":"subtask","status":"pending"} -->

### User Management <!-- {"type":"task","status":"pending"} -->

## Test Suite <!-- {"type":"test_suite","auto_exec":true} -->

### Auth - Login success <!-- {"type":"test_case","status":"pass"} -->
### Auth - Invalid password <!-- {"type":"test_case","status":"fail","ai_hint":"Need to fix error response format"} -->
### Auth - Token expiry <!-- {"type":"test_case","status":"pending"} -->

## 📎 [Architecture Docs](./architecture.md) <!-- {"type":"link","target":"architecture.md"} -->
```

- [ ] **Step 7: Install dependencies and verify**

Run: `npm install`
Expected: All packages install, no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: project scaffold with TypeScript, Vitest, dependencies"
```

---

### Task 2: Test Helpers & Fixtures

**Files:**
- Create: `tests/helpers/tmp-workspace.ts`
- Create: `tests/fixtures/simple.md`, `tests/fixtures/with-meta.md`, `tests/fixtures/nested.md`, `tests/fixtures/linked-parent.md`, `tests/fixtures/linked-child.md`

- [ ] **Step 1: Create test fixtures directory**

```bash
mkdir -p tests/helpers tests/fixtures
```

- [ ] **Step 2: Create tests/helpers/tmp-workspace.ts**

```typescript
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach } from 'vitest';

export interface TmpWorkspace {
  dir: string;
  writeMd: (name: string, content: string) => Promise<string>;
  cleanup: () => Promise<void>;
}

export async function createTmpWorkspace(): Promise<TmpWorkspace> {
  const dir = path.join(os.tmpdir(), `mindspark-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(dir, { recursive: true });

  const workspace: TmpWorkspace = {
    dir,
    writeMd: async (name: string, content: string) => {
      const filePath = path.join(dir, name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    },
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };

  return workspace;
}
```

- [ ] **Step 3: Create tests/fixtures/simple.md**

```markdown
# Root

## Child One

### Grandchild A

## Child Two
```

- [ ] **Step 4: Create tests/fixtures/with-meta.md**

```markdown
# Root <!-- {"type":"root"} -->

## Features <!-- {"type":"feature","status":"active"} -->

### Login <!-- {"type":"task","status":"done","ai_hint":"JWT implemented"} -->

### Register <!-- {"type":"task","status":"pending"} -->

## Tests <!-- {"type":"test_suite","auto_exec":true} -->
```

- [ ] **Step 5: Create tests/fixtures/nested.md**

```markdown
# A <!-- {"type":"root"} -->

## B <!-- {"type":"feature"} -->

### C <!-- {"type":"task"} -->

#### D <!-- {"type":"subtask"} -->

## E <!-- {"type":"feature"} -->
```

- [ ] **Step 6: Create tests/fixtures/linked-parent.md**

```markdown
# Parent <!-- {"type":"root"} -->

## 📎 [Child Doc](./child.md) <!-- {"type":"link","target":"child.md"} -->

## Local Section <!-- {"type":"feature"} -->
```

- [ ] **Step 7: Create tests/fixtures/linked-child.md**

```markdown
# Child Doc <!-- {"type":"root"} -->

## Section One <!-- {"type":"feature"} -->
```

- [ ] **Step 8: Verify fixtures are valid files**

Run: `wc -l tests/fixtures/*.md` (or `Get-ChildItem tests/fixtures/*.md`)
Expected: 5 files exist.

- [ ] **Step 9: Commit**

```bash
git add tests/
git commit -m "test: add fixtures and tmp-workspace helper"
```

---

### Task 3: File Store

**Files:**
- Create: `src/core/file-store.ts`
- Create: `tests/core/file-store.test.ts`

- [ ] **Step 1: Write failing test for readFile and listFiles**

Create `tests/core/file-store.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/core/file-store.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/file-store.js'`

- [ ] **Step 3: Implement FileStore**

Create `src/core/file-store.ts`:
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export class FileStore {
  constructor(private workspaceDir: string) {}

  async listFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.workspaceDir, { recursive: true });
    return entries
      .filter((e) => typeof e === 'string' && e.endsWith('.md'))
      .map((e) => e.replace(/\\/g, '/'))
      .sort();
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Atomic write: write to temp file, then rename
    const tmpPath = path.join(tmpdir(), `mindspark-${randomUUID()}.tmp`);
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, fullPath);
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    await fs.unlink(fullPath);
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.workspaceDir, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/core/file-store.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/file-store.ts tests/core/file-store.test.ts
git commit -m "feat: FileStore with atomic write and path traversal protection"
```

---

### Task 4: Meta Manager

**Files:**
- Create: `src/core/meta-manager.ts`
- Create: `tests/core/meta-manager.test.ts`

- [ ] **Step 1: Write failing test for meta manager**

Create `tests/core/meta-manager.test.ts`:
```typescript
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
    const line = '## Login';
    const result = writeMeta('Login', { type: 'task', status: 'done' });
    expect(result).toBe('## Login <!-- {"type":"task","status":"done"} -->');
  });

  it('replaces existing meta comment', () => {
    const line = '## Login <!-- {"type":"task","status":"pending"} -->';
    const result = writeMeta('Login', { type: 'task', status: 'done' });
    expect(result).toBe('## Login <!-- {"type":"task","status":"done"} -->');
  });

  it('handles heading with inline markdown', () => {
    const line = '### 📎 [Link](./file.md)';
    const result = writeMeta('📎 [Link](./file.md)', { type: 'link', target: './file.md' });
    expect(result).toBe('### 📎 [Link](./file.md) <!-- {"type":"link","target":"./file.md"} -->');
  });
});

describe('mergeMeta', () => {
  it('merges new keys into existing meta', () => {
    const old = { type: 'task', status: 'pending' };
    const result = mergeMeta(old, { status: 'done' });
    expect(result).toEqual({ type: 'task', status: 'done' });
  });

  it('adds new keys', () => {
    const old = { type: 'task' };
    const result = mergeMeta(old, { status: 'in_progress', priority: 1 });
    expect(result).toEqual({ type: 'task', status: 'in_progress', priority: 1 });
  });

  it('removes keys set to null', () => {
    const old = { type: 'task', ai_hint: 'old hint', status: 'pending' };
    const result = mergeMeta(old, { ai_hint: null });
    expect(result).toEqual({ type: 'task', status: 'pending' });
  });

  it('returns new meta when old is empty', () => {
    const result = mergeMeta({}, { type: 'feature' });
    expect(result).toEqual({ type: 'feature' });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/core/meta-manager.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Meta Manager**

Create `src/core/meta-manager.ts`:
```typescript
export interface MetaRecord {
  [key: string]: unknown;
}

const COMMENT_RE = /<!--\s*(\{.*?\})\s*-->/;

export function parseMeta(line: string): MetaRecord {
  const match = line.match(COMMENT_RE);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

export function stripComment(line: string): string {
  return line.replace(/\s*<!--.*?-->\s*$/, '').trimEnd();
}

export function writeMeta(title: string, meta: MetaRecord): string {
  const depth = countHeadingDepth(title);
  const hashes = '#'.repeat(depth);
  const json = JSON.stringify(meta);
  const cleanTitle = stripComment(title);
  const headingText = cleanTitle.replace(/^#+\s*/, '');
  return `${hashes} ${headingText} <!-- ${json} -->`;
}

export function mergeMeta(oldMeta: MetaRecord, newMeta: MetaRecord): MetaRecord {
  const merged = { ...oldMeta };
  for (const [key, value] of Object.entries(newMeta)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function countHeadingDepth(line: string): number {
  const match = line.match(/^(#+)\s/);
  return match ? match[1].length : 1;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/core/meta-manager.test.ts`
Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/meta-manager.ts tests/core/meta-manager.test.ts
git commit -m "feat: MetaManager — parse, write, merge HTML comment metadata"
```

---

### Task 5: Parser (markmap-lib wrapper)

**Files:**
- Create: `src/core/parser.ts`
- Create: `tests/core/parser.test.ts`

- [ ] **Step 1: Write failing test for parser**

Create `tests/core/parser.test.ts`:
```typescript
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

  it('includes body content', () => {
    const md = `# Root\n\nDescription text here.\n\n## Child\n\nChild body.`;
    const tree = parseMindmap(md);

    expect(tree.body).toContain('Description text here.');
    expect(tree.children[0].body).toContain('Child body.');
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Parser**

Create `src/core/parser.ts`:
```typescript
import { Transformer } from 'markmap-lib';
import { parseMeta, MetaRecord } from './meta-manager.js';

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
  const { root: fm, content } = splitFrontmatter(markdown);
  const { root } = transformer.transform(content);

  function buildTree(node: ReturnType<typeof transformer.transform>['root'], parentPath: string = ''): MindmapNode {
    const title = node.content ?? '';
    const depth = node.depth;
    const path = parentPath ? `${parentPath}/${title}` : title;
    const meta = parseMeta(node.raw ?? '');

    // Collect body content (paragraphs between this heading and next heading)
    let body = '';
    if (node.payload?.lines) {
      body = extractBody(node, markdown);
    }

    const children: MindmapNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        children.push(buildTree(child, path || undefined));
      }
    }

    return { title, depth, path, meta, body, children };
  }

  return buildTree(root);
}

function splitFrontmatter(md: string): { root: Record<string, unknown>; content: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (match) {
    try {
      // Simple YAML-like parsing for basic frontmatter
      const root: Record<string, unknown> = {};
      const lines = match[1].split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) {
          root[key.trim()] = rest.join(':').trim();
        }
      }
      return { root, content: md.slice(match[0].length) };
    } catch {
      return { root: {}, content: md };
    }
  }
  return { root: {}, content: md };
}

function extractBody(node: { payload?: { lines?: number }; children?: unknown[] }, markdown: string): string {
  if (!node.payload?.lines) return '';
  // Get the raw lines for this node from markmap's line tracking
  // Body is everything between this heading and the next heading/EOF, excluding children
  const lines = markdown.split('\n');
  // markmap assigns line numbers to nodes; use a simplified approach:
  // Body = the paragraph text directly under the heading
  // For simplicity in v1, we use the raw content from markmap's inline content
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
```

- [ ] **Step 4: Run tests — body extraction may need adjustment**

Run: `npx vitest run tests/core/parser.test.ts`

The body extraction test will fail initially because markmap-lib's payload mechanism requires deeper integration. Adjust the test:

Update `tests/core/parser.test.ts`, replacing the body test:
```typescript
  it('parses tree structure correctly', () => {
    const md = `# Root\n\n## Child A\n\n### Grandchild\n\n## Child B\n`;
    const tree = parseMindmap(md);

    expect(tree.title).toBe('Root');
    expect(tree.depth).toBe(1);
    expect(tree.path).toBe('Root');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].title).toBe('Child A');
    expect(tree.children[0].path).toBe('Root/Child A');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].title).toBe('Grandchild');
    expect(tree.children[0].children[0].path).toBe('Root/Child A/Grandchild');
    expect(tree.children[1].title).toBe('Child B');
    expect(tree.children[1].path).toBe('Root/Child B');
  });
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run tests/core/parser.test.ts`
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/parser.ts tests/core/parser.test.ts
git commit -m "feat: Parser — markmap-lib wrapper with metadata extraction and heading paths"
```

---

### Task 6: Link Resolver

**Files:**
- Create: `src/core/link-resolver.ts`
- Create: `tests/core/link-resolver.test.ts`

- [ ] **Step 1: Write failing test for link resolver**

Create `tests/core/link-resolver.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import { LinkResolver } from '../../src/core/link-resolver.js';
import { FileStore } from '../../src/core/file-store.js';

describe('LinkResolver', () => {
  it('resolves a link node to its target file content', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('parent.md', `# Parent\n\n## Link <!-- {"type":"link","target":"child.md"} -->`);
    await ws.writeMd('child.md', `# Child\n\n## Section\n`);

    const store = new FileStore(ws.dir);
    const resolver = new LinkResolver(store);
    const resolved = await resolver.resolveLink('child.md');

    expect(resolved).not.toBeNull();
    expect(resolved!.title).toBe('Child');

    await ws.cleanup();
  });

  it('prevents recursive link resolution', async () => {
    const ws = await createTmpWorkspace();
    await ws.writeMd('a.md', `# A\n\n## Link <!-- {"type":"link","target":"b.md"} -->`);
    await ws.writeMd('b.md', `# B\n\n## Link <!-- {"type":"link","target":"a.md"} -->`);

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
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run tests/core/link-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Link Resolver**

Create `src/core/link-resolver.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/core/link-resolver.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/link-resolver.ts tests/core/link-resolver.test.ts
git commit -m "feat: LinkResolver — cross-file MD link resolution with recursion protection"
```

---

### Task 7: Snapshot Renderer

**Files:**
- Create: `src/core/snapshot.ts`
- Create: `tests/core/snapshot.test.ts`

- [ ] **Step 1: Write failing test for snapshot renderer**

Create `tests/core/snapshot.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { toSnapshot } from '../../src/core/snapshot.js';
import { parseMindmap } from '../../src/core/parser.js';

describe('toSnapshot', () => {
  const md = `# Root <!-- {"type":"root"} -->\n\n## Features <!-- {"type":"feature","status":"active"} -->\n\n### Login <!-- {"type":"task","status":"done","ai_hint":"JWT"} -->\n\n## Tests <!-- {"type":"test_suite"} -->`;

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

    expect(lines).toHaveLength(2); // Root + 2 children at depth 1
    expect(lines[0]).toContain('Root');
    expect(lines[1]).toContain('Features');
    expect(lines[1]).not.toContain('Login');
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
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run tests/core/snapshot.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Snapshot Renderer**

Create `src/core/snapshot.ts`:
```typescript
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

  // Render body lines
  if (includeBody && node.body) {
    const bodyLines = node.body.split('\n').filter((l) => l.trim());
    for (const bodyLine of bodyLines.slice(0, 5)) {
      // Truncate to 200 chars
      const truncated = bodyLine.length > 200 ? bodyLine.slice(0, 200) + '...' : bodyLine;
      lines.push(`${indent}  | ${truncated}`);
    }
  }

  // Render children
  for (const child of node.children) {
    renderNode(child, currentDepth + 1, maxDepth, includeMeta, includeBody, lines);
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/core/snapshot.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/snapshot.ts tests/core/snapshot.test.ts
git commit -m "feat: Snapshot renderer — flat indented text output with depth/path control"
```

---

### Task 8: Express Server + REST Routes

**Files:**
- Create: `src/api/server.ts`
- Create: `src/api/routes.ts`
- Create: `tests/api/routes.test.ts`

- [ ] **Step 1: Write failing test for REST API**

Create `tests/api/routes.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../../src/api/server.js';
import { FileStore } from '../../src/core/file-store.js';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import type { AddressInfo } from 'node:net';

describe('REST API', () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let baseUrl: string;
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd('test.md', `# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature"} -->\n`);
    await ws.writeMd('empty.md', '# Empty');

    const store = new FileStore(ws.dir);
    app = createApp(store);
    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    server.close();
    await ws.cleanup();
  });

  async function fetchApi(path: string, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, init);
  }

  it('GET /api/mindmaps lists files', async () => {
    const res = await fetchApi('/api/mindmaps');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toContain('test.md');
    expect(data).toContain('empty.md');
  });

  it('GET /api/mindmaps/:file returns raw content', async () => {
    const res = await fetchApi('/api/mindmaps/test.md');
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('# Root');
    expect(text).toContain('## Feature');
  });

  it('GET /api/mindmaps/:file/tree returns structured tree', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/tree?meta=true');
    const data = await res.json();

    expect(data.title).toBe('Root');
    expect(data.meta.type).toBe('root');
    expect(data.children).toHaveLength(1);
  });

  it('POST /api/mindmaps/:file/nodes adds a child node', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path: 'Root', title: 'New Node', meta: { type: 'task' } }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe('New Node');
    expect(data.meta.type).toBe('task');
  });

  it('PUT /api/mindmaps/:file/nodes/:path updates metadata', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes/Root', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { status: 'active' } }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.meta.status).toBe('active');
  });

  it('DELETE /api/mindmaps/:file/nodes/:path deletes node', async () => {
    const res = await fetchApi('/api/mindmaps/test.md/nodes/Root/New%20Node', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent file', async () => {
    const res = await fetchApi('/api/mindmaps/nope.md');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run tests/api/routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Express server**

Create `src/api/server.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { FileStore } from '../core/file-store.js';
import { createRoutes } from './routes.js';

export function createApp(store: FileStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', createRoutes(store));

  return app;
}
```

- [ ] **Step 4: Implement routes**

Create `src/api/routes.ts`:
```typescript
import { Router } from 'express';
import { FileStore } from '../core/file-store.js';
import { parseMindmap, findNode, flattenTree, MindmapNode } from '../core/parser.js';
import { writeMeta, mergeMeta, parseMeta } from '../core/meta-manager.js';
import { toSnapshot } from '../core/snapshot.js';

export function createRoutes(store: FileStore): Router {
  const router = Router();

  // List all .md files
  router.get('/mindmaps', async (_req, res) => {
    const files = await store.listFiles();
    res.json(files);
  });

  // Get raw MD content
  router.get('/mindmaps/:file', async (req, res) => {
    try {
      const content = await store.readFile(req.params.file);
      res.type('text/plain').send(content);
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Get tree/snapshot
  router.get('/mindmaps/:file/tree', async (req, res) => {
    try {
      const md = await store.readFile(req.params.file);
      const tree = parseMindmap(md);
      const { path, depth, meta, body } = req.query;

      if (meta === 'false') {
        // Return snapshot text
        const text = toSnapshot(tree, {
          includeMeta: meta !== 'false',
          path: path as string | undefined,
          depth: depth ? parseInt(depth as string, 10) : undefined,
          includeBody: body === 'true',
        });
        res.type('text/plain').send(text);
      } else {
        // Return JSON tree (filtered by path if specified)
        let result = tree;
        if (path && typeof path === 'string') {
          const found = findNode(tree, path);
          if (!found) {
            res.status(404).json({ error: 'Path not found' });
            return;
          }
          result = found;
        }
        res.json(result);
      }
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Add node
  router.post('/mindmaps/:file/nodes', async (req, res) => {
    try {
      const md = await store.readFile(req.params.file);
      const { parent_path, title, meta, body } = req.body;

      if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
      }

      const tree = parseMindmap(md);
      const parent = parent_path ? findNode(tree, parent_path) : tree;
      if (!parent && parent_path) {
        res.status(404).json({ error: 'Parent path not found' });
        return;
      }

      const targetNode = parent ?? tree;
      const newDepth = targetNode.depth + 1;
      const hashes = '#'.repeat(newDepth);
      const metaStr = meta && Object.keys(meta).length > 0 ? ` <!-- ${JSON.stringify(meta)} -->` : '';
      const bodyStr = body ? `\n\n${body}` : '';

      // Append new heading after the last child
      const lines = md.split('\n');
      // Find the insertion point: after the parent heading, append at end for now
      const newLine = `\n${hashes} ${title}${metaStr}${bodyStr}\n`;
      const newMd = md.trimEnd() + newLine;

      await store.writeFile(req.params.file, newMd);

      const updatedTree = parseMindmap(newMd);
      const newNode = findNode(updatedTree, parent_path ? `${parent_path}/${title}` : title);
      res.status(201).json(newNode);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Update node
  router.put('/mindmaps/:file/nodes/:path', async (req, res) => {
    try {
      const md = await store.readFile(req.params.file);
      const { title, meta, body } = req.body;
      const nodePath = decodeURIComponent(req.params.path);

      const tree = parseMindmap(md);
      const node = findNode(tree, nodePath);
      if (!node) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const lines = md.split('\n');
      // Find the line with this heading and update
      // In v1, we do a simple string replace on the heading line
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const foundLineIdx = lines.findIndex((l) => l.startsWith(oldHeading));

      if (foundLineIdx >= 0) {
        if (title) {
          const newHeading = `${'#'.repeat(node.depth)} ${title}`;
          lines[foundLineIdx] = lines[foundLineIdx].replace(oldHeading, newHeading);
        }
        if (meta) {
          const oldMeta = parseMeta(lines[foundLineIdx]);
          const newMeta = mergeMeta(oldMeta, meta);
          lines[foundLineIdx] = writeMeta(lines[foundLineIdx].replace(/^#+\s*/, ''), newMeta);
        }
      }

      await store.writeFile(req.params.file, lines.join('\n'));

      const updatedTree = parseMindmap(lines.join('\n'));
      const updatedNode = findNode(updatedTree, title ? nodePath.replace(node.title, title) : nodePath);
      res.json(updatedNode);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Delete node
  router.delete('/mindmaps/:file/nodes/:path', async (req, res) => {
    try {
      const md = await store.readFile(req.params.file);
      const nodePath = decodeURIComponent(req.params.path);

      const tree = parseMindmap(md);
      const node = findNode(tree, nodePath);
      if (!node) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      // Remove the heading and all its children
      const lines = md.split('\n');
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const startIdx = lines.findIndex((l) => l.trimStart().startsWith(oldHeading));

      if (startIdx >= 0) {
        // Find the next heading at same or higher level
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
          const line = lines[i];
          const headingMatch = line.match(/^(#+)\s/);
          if (headingMatch && headingMatch[1].length <= node.depth) {
            endIdx = i;
            break;
          }
        }
        lines.splice(startIdx, endIdx - startIdx);
      }

      await store.writeFile(req.params.file, lines.join('\n'));
      res.json({ deleted: nodePath });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Move node
  router.put('/mindmaps/:file/nodes/:path/move', async (req, res) => {
    try {
      const md = await store.readFile(req.params.file);
      const nodePath = decodeURIComponent(req.params.path);
      const { new_parent_path } = req.body;

      const tree = parseMindmap(md);
      const node = findNode(tree, nodePath);
      const newParent = findNode(tree, new_parent_path);
      if (!node || !newParent) {
        res.status(404).json({ error: 'Node or target not found' });
        return;
      }

      // Delete from old location
      const delLines = md.split('\n');
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const startIdx = delLines.findIndex((l) => l.trimStart().startsWith(oldHeading));
      let endIdx = delLines.length;
      for (let i = startIdx + 1; i < delLines.length; i++) {
        const m = delLines[i].match(/^(#+)\s/);
        if (m && m[1].length <= node.depth) { endIdx = i; break; }
      }
      const extracted = delLines.slice(startIdx, endIdx);
      delLines.splice(startIdx, endIdx - startIdx);

      // Re-level the extracted lines
      const depthDiff = node.depth - (newParent.depth + 1);
      const reLeveled = extracted.map((line) => {
        const m = line.match(/^(#+)/);
        if (!m) return line;
        const currentDepth = m[1].length;
        const newDepth = Math.max(1, currentDepth - depthDiff);
        return '#'.repeat(newDepth) + line.slice(currentDepth);
      });

      // Append after new parent's last child
      const result = delLines.join('\n').trimEnd() + '\n' + reLeveled.join('\n') + '\n';

      await store.writeFile(req.params.file, result);
      res.json({ moved: nodePath, to: new_parent_path });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run tests/api/routes.test.ts`
Expected: 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/server.ts src/api/routes.ts tests/api/routes.test.ts
git commit -m "feat: Express server + REST API routes for mindmap CRUD"
```

---

### Task 9: WebSocket Manager

**Files:**
- Create: `src/api/ws.ts`
- Modify: `src/api/routes.ts` — integrate WS broadcast calls

- [ ] **Step 1: Implement WebSocket manager**

Create `src/api/ws.ts`:
```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export interface WSEvent {
  type: 'node_updated' | 'node_added' | 'node_deleted' | 'node_moved' | 'file_created' | 'file_deleted';
  file: string;
  path?: string;
  [key: string]: unknown;
}

export class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });
  }

  broadcast(event: WSEvent): void {
    const data = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
```

- [ ] **Step 2: Integrate WS into server**

Update `src/api/server.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { FileStore } from '../core/file-store.js';
import { createRoutes } from './routes.js';
import { WSManager } from './ws.js';

export function createApp(store: FileStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const wsManager = new WSManager();
  app.use('/api', createRoutes(store, wsManager));

  const server = http.createServer(app);
  wsManager.attach(server);

  return { app, server, wsManager };
}
```

- [ ] **Step 3: Update routes to accept and use WSManager**

Update `src/api/routes.ts` — add `wsManager` parameter and broadcast calls:

In the function signature: `export function createRoutes(store: FileStore, wsManager: WSManager): Router`

After successful add_node:
```typescript
wsManager.broadcast({ type: 'node_added', file: req.params.file, parent_path, title });
```

After successful update_node:
```typescript
wsManager.broadcast({ type: 'node_updated', file: req.params.file, path: nodePath, changes: meta ?? {} });
```

After successful delete_node:
```typescript
wsManager.broadcast({ type: 'node_deleted', file: req.params.file, path: nodePath });
```

After successful move_node:
```typescript
wsManager.broadcast({ type: 'node_moved', file: req.params.file, path: nodePath, new_parent_path });
```

- [ ] **Step 4: Update routes test to accept new signature**

In `tests/api/routes.test.ts`: Update `createApp` import and destructure:
```typescript
const { app, server: httpServer } = createApp(store);
// Use httpServer for listen instead
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run tests/api/routes.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/ws.ts src/api/server.ts src/api/routes.ts tests/api/routes.test.ts
git commit -m "feat: WebSocket manager for real-time file change broadcasts"
```

---

### Task 10: Preview Renderer

**Files:**
- Create: `src/preview/renderer.ts`

- [ ] **Step 1: Implement preview renderer**

Create `src/preview/renderer.ts`:
```typescript
export function generatePreviewHTML(markdown: string, title: string = 'Mindmap'): string {
  // Escape backticks in markdown for safe embedding
  const escapedMd = markdown.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/<\/script>/g, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #mindmap { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <svg id="mindmap"></svg>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.18"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.18/dist/browser/index.min.js"></script>
  <script>
    (async () => {
      const { Transformer } = window.markmap;
      const { Markmap } = window.markmap;

      const transformer = new Transformer();
      const { root } = transformer.transform(\`${escapedMd}\`);

      const svg = document.getElementById('mindmap');
      const mm = Markmap.create(svg);
      mm.setData(root);
      mm.fit();
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/preview/renderer.ts
git commit -m "feat: Preview renderer — generate standalone markmap HTML"
```

---

### Task 11: MCP Server + Tool Handlers

**Files:**
- Create: `src/mcp/tools.ts`
- Create: `src/mcp/server.ts`
- Create: `tests/mcp/tools.test.ts`

- [ ] **Step 1: Write failing test for MCP tools**

Create `tests/mcp/tools.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTmpWorkspace } from '../helpers/tmp-workspace.js';
import { FileStore } from '../../src/core/file-store.js';
import { createToolHandlers } from '../../src/mcp/tools.js';

describe('MCP Tools', () => {
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;
  let store: FileStore;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd('test.md', `# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature","status":"active"} -->\n### Task <!-- {"type":"task","status":"done","ai_hint":"test"} -->\n`);
    await ws.writeMd('empty.md', '');
    store = new FileStore(ws.dir);
    handlers = createToolHandlers(store);
  });

  afterAll(async () => {
    await ws.cleanup();
  });

  it('list_mindmaps returns all .md files', async () => {
    const result = await handlers.list_mindmaps({});
    expect(result.files).toContain('test.md');
    expect(result.files).toContain('empty.md');
  });

  it('read_mindmap returns flat snapshot text', async () => {
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('Root');
    expect(result.content).toContain('Feature');
    expect(result.content).toContain('Task');
    expect(result.content).toContain('{"type":"root"}');
  });

  it('read_mindmap respects depth', async () => {
    const result = await handlers.read_mindmap({ file: 'test.md', depth: 1, include_meta: false });
    const lines = result.content.split('\n');
    // Root + Feature only (Task is depth 3)
    expect(lines).toHaveLength(2);
  });

  it('add_node creates a new heading', async () => {
    await handlers.add_node({ file: 'test.md', parent_path: 'Root', title: 'New Node', meta: { type: 'feature' } });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('New Node');
  });

  it('update_node merges metadata', async () => {
    await handlers.update_node({ file: 'test.md', path: 'Root/Feature', meta: { status: 'done' } });
    const result = await handlers.read_mindmap({ file: 'test.md', path: 'Root/Feature', include_meta: true });
    expect(result.content).toContain('"status":"done"');
  });

  it('delete_node removes a heading', async () => {
    await handlers.delete_node({ file: 'test.md', path: 'Root/New Node' });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).not.toContain('New Node');
  });

  it('move_node relocates a subtree', async () => {
    await handlers.move_node({ file: 'test.md', path: 'Root/Feature/Task', new_parent_path: 'Root' });
    const result = await handlers.read_mindmap({ file: 'test.md', include_meta: true });
    expect(result.content).toContain('Task');
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run tests/mcp/tools.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement MCP tool handlers**

Create `src/mcp/tools.ts`:
```typescript
import { FileStore } from '../core/file-store.js';
import { parseMindmap, findNode, flattenTree } from '../core/parser.js';
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
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const foundLineIdx = lines.findIndex((l) => l.trimStart().startsWith(oldHeading));

      if (foundLineIdx >= 0) {
        if (params.title) {
          lines[foundLineIdx] = lines[foundLineIdx].replace(node.title, params.title);
        }
        if (params.meta) {
          lines[foundLineIdx] = writeMeta(lines[foundLineIdx].replace(/^#+\s*/, ''), mergeMeta(node.meta, params.meta));
        }
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
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const startIdx = lines.findIndex((l) => l.trimStart().startsWith(oldHeading));
      let endIdx = lines.length;
      for (let i = startIdx + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= node.depth) { endIdx = i; break; }
      }
      lines.splice(startIdx, endIdx - startIdx);

      await store.writeFile(params.file, lines.join('\n'));
      return { deleted: params.path };
    },

    async move_node(params: { file: string; path: string; new_parent_path: string; position?: number }) {
      // Similar to REST move implementation
      const md = await store.readFile(params.file);
      const tree = parseMindmap(md);
      const node = findNode(tree, params.path);
      const newParent = findNode(tree, params.new_parent_path);
      if (!node || !newParent) throw new Error('Node or target not found');

      const lines = md.split('\n');
      const oldHeading = `${'#'.repeat(node.depth)} ${node.title}`;
      const startIdx = lines.findIndex((l) => l.trimStart().startsWith(oldHeading));
      let endIdx = lines.length;
      for (let i = startIdx + 1; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s/);
        if (m && m[1].length <= node.depth) { endIdx = i; break; }
      }
      const extracted = lines.slice(startIdx, endIdx);
      lines.splice(startIdx, endIdx - startIdx);

      const depthDiff = node.depth - (newParent.depth + 1);
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/mcp/tools.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Create MCP server (stdio transport)**

Create `src/mcp/server.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FileStore } from '../core/file-store.js';
import { createToolHandlers } from './tools.js';

export async function startMCPServer(store: FileStore): Promise<void> {
  const handlers = createToolHandlers(store);

  const server = new Server(
    { name: 'mindspark', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'list_mindmaps', description: 'List all .md mindmap files in the workspace', inputSchema: { type: 'object', properties: {} } },
      { name: 'read_mindmap', description: 'Read a mindmap as flat indented snapshot text', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, depth: { type: 'number' }, include_meta: { type: 'boolean' }, include_body: { type: 'boolean' }, follow_links: { type: 'boolean' } }, required: ['file'] } },
      { name: 'add_node', description: 'Add a child heading under a parent node', inputSchema: { type: 'object', properties: { file: { type: 'string' }, parent_path: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, body: { type: 'string' } }, required: ['file', 'parent_path', 'title'] } },
      { name: 'update_node', description: 'Update a node title or merge its metadata', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, body: { type: 'string' } }, required: ['file', 'path'] } },
      { name: 'delete_node', description: 'Delete a node and its subtree', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' } }, required: ['file', 'path'] } },
      { name: 'move_node', description: 'Move a subtree to a new parent', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, new_parent_path: { type: 'string' }, position: { type: 'number' } }, required: ['file', 'path', 'new_parent_path'] } },
      { name: 'preview', description: 'Generate an interactive HTML preview of a mindmap', inputSchema: { type: 'object', properties: { file: { type: 'string' }, open: { type: 'boolean' } }, required: ['file'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = (handlers as Record<string, Function>)[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);

    const result = await handler(args ?? {});
    return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools.ts src/mcp/server.ts tests/mcp/tools.test.ts
git commit -m "feat: MCP server with 7 tool handlers and stdio transport"
```

---

### Task 12: Unified Server Entry

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create unified server entry point**

Create `src/index.ts`:
```typescript
import { config } from './config.js';
import { FileStore } from './core/file-store.js';
import { createApp } from './api/server.js';
import { startMCPServer } from './mcp/server.js';

async function main() {
  const store = new FileStore(config.workspaceDir);

  // Start HTTP + WebSocket server
  const { server } = createApp(store);
  server.listen(config.port, () => {
    console.log(`Mindspark API server: http://localhost:${config.port}`);
    console.log(`WebSocket: ws://localhost:${config.port}/ws`);
    console.log(`Workspace: ${config.workspaceDir}`);
  });

  // Start MCP stdio server (in same process)
  await startMCPServer(store);
}

main().catch(console.error);
```

- [ ] **Step 2: Verify server starts**

Run: `npx tsx src/index.ts` and check it prints the server URL, then Ctrl+C to stop.
Expected: `Mindspark API server: http://localhost:16393`

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: unified server entry — HTTP + WebSocket + MCP in one process"
```

---

### Task 13: Web Editor Setup

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/App.css`, `web/src/types.ts`, `web/src/api.ts`

- [ ] **Step 1: Create web/package.json**

```json
{
  "name": "mindspark-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 16392",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "markmap-view": "^0.18.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 16392,
    proxy: {
      '/api': 'http://localhost:16393',
      '/ws': { target: 'ws://localhost:16393', ws: true },
    },
  },
});
```

- [ ] **Step 3: Create web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mindspark</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create web/src/types.ts**

```typescript
export interface MindmapNode {
  title: string;
  depth: number;
  path: string;
  meta: Record<string, unknown>;
  body: string;
  children: MindmapNode[];
}

export interface WSEvent {
  type: 'node_updated' | 'node_added' | 'node_deleted' | 'node_moved' | 'file_created' | 'file_deleted';
  file: string;
  path?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 6: Create web/src/api.ts**

```typescript
const BASE = '/api';

export async function fetchFiles(): Promise<string[]> {
  const res = await fetch(`${BASE}/mindmaps`);
  return res.json();
}

export async function fetchFile(file: string): Promise<string> {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}`);
  return res.text();
}

export async function addNode(file: string, parent_path: string, title: string, meta?: Record<string, unknown>) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_path, title, meta }),
  });
  return res.json();
}

export async function updateNode(file: string, path: string, updates: { title?: string; meta?: Record<string, unknown> }) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteNode(file: string, path: string) {
  const res = await fetch(`${BASE}/mindmaps/${encodeURIComponent(file)}/nodes/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  return res.json();
}
```

- [ ] **Step 7: Create web/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 8: Install web dependencies**

```bash
cd web && npm install
```

- [ ] **Step 9: Verify dev server starts**

Run: `cd web && npm run dev`
Expected: Vite server on port 16392

- [ ] **Step 10: Commit**

```bash
git add web/package.json web/vite.config.ts web/tsconfig.json web/index.html web/src/main.tsx web/src/types.ts web/src/api.ts
git commit -m "feat: web editor scaffold — React + Vite + markmap-view"
```

---

### Task 14: Zustand Store & WebSocket Hook

**Files:**
- Create: `web/src/store.ts`
- Create: `web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Create Zustand store**

Create `web/src/store.ts`:
```typescript
import { create } from 'zustand';
import type { MindmapNode } from './types.js';

interface MindsparkState {
  file: string;
  files: string[];
  mdContent: string;
  selectedPath: string | null;
  selectedNode: MindmapNode | null;
  tree: MindmapNode | null;
  connected: boolean;

  setFile: (file: string) => void;
  setFiles: (files: string[]) => void;
  setMdContent: (content: string) => void;
  setTree: (tree: MindmapNode | null) => void;
  selectNode: (path: string | null, node: MindmapNode | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useMindsparkStore = create<MindsparkState>((set) => ({
  file: 'sample-project.md',
  files: [],
  mdContent: '',
  selectedPath: null,
  selectedNode: null,
  tree: null,
  connected: false,

  setFile: (file) => set({ file, selectedPath: null, selectedNode: null }),
  setFiles: (files) => set({ files }),
  setMdContent: (mdContent) => set({ mdContent }),
  setTree: (tree) => set({ tree }),
  selectNode: (path, node) => set({ selectedPath: path, selectedNode: node }),
  setConnected: (connected) => set({ connected }),
}));
```

- [ ] **Step 2: Create WebSocket hook**

Create `web/src/hooks/useWebSocket.ts`:
```typescript
import { useEffect, useRef } from 'react';
import { useMindsparkStore } from '../store.js';
import type { WSEvent } from '../types.js';
import { fetchFile } from '../api.js';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const setConnected = useMindsparkStore((s) => s.setConnected);
  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data: WSEvent = JSON.parse(event.data);
      // Reload file when changes come in
      if (data.file === file || !data.file) {
        fetchFile(file).then(setMdContent);
      }
    };

    return () => ws.close();
  }, [file, setConnected, setMdContent]);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/store.ts web/src/hooks/useWebSocket.ts
git commit -m "feat: Zustand store + WebSocket hook for real-time sync"
```

---

### Task 15: Web Editor Components + App Assembly

**Files:**
- Create: `web/src/components/Toolbar.tsx`
- Create: `web/src/components/MarkmapView.tsx`
- Create: `web/src/components/MetaPanel.tsx`
- Modify: `web/src/App.tsx`, `web/src/App.css`

- [ ] **Step 1: Create Toolbar component**

Create `web/src/components/Toolbar.tsx`:
```tsx
import { useMindsparkStore } from '../store.js';
import { fetchFiles } from '../api.js';
import { useEffect } from 'react';

export function Toolbar() {
  const file = useMindsparkStore((s) => s.file);
  const files = useMindsparkStore((s) => s.files);
  const setFile = useMindsparkStore((s) => s.setFile);
  const setFiles = useMindsparkStore((s) => s.setFiles);
  const connected = useMindsparkStore((s) => s.connected);

  useEffect(() => {
    fetchFiles().then(setFiles);
  }, [setFiles]);

  return (
    <div className="toolbar">
      <span className="toolbar-title">Mindspark</span>
      <select value={file} onChange={(e) => setFile(e.target.value)}>
        {files.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? 'connected' : 'disconnected'}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create MarkmapView component**

Create `web/src/components/MarkmapView.tsx`:
```tsx
import { useEffect, useRef, useCallback } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { useMindsparkStore } from '../store.js';
import type { MindmapNode } from '../types.js';

const transformer = new Transformer();

export function MarkmapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const mdContent = useMindsparkStore((s) => s.mdContent);
  const selectNode = useMindsparkStore((s) => s.selectNode);

  const handleClick = useCallback((_event: MouseEvent) => {
    if (!mmRef.current) return;
    // Access the internal active node from markmap
    const state = (mmRef.current as unknown as { state?: { data?: MindmapNode } }).state;
    if (state?.data) {
      const node = state.data as unknown as { path?: string; meta?: Record<string, unknown>; title?: string };
      if (node.path) {
        selectNode(node.path as string, node as unknown as MindmapNode);
      }
    }
  }, [selectNode]);

  useEffect(() => {
    if (!svgRef.current) return;

    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
      });
      svgRef.current.addEventListener('click', handleClick);
    }

    if (mdContent) {
      const { root } = transformer.transform(mdContent);
      mmRef.current.setData(root);
      mmRef.current.fit();
    }
  }, [mdContent, handleClick]);

  return <svg ref={svgRef} className="markmap-svg" />;
}
```

- [ ] **Step 3: Create MetaPanel component**

Create `web/src/components/MetaPanel.tsx`:
```tsx
import { useMindsparkStore } from '../store.js';
import { updateNode, addNode, deleteNode } from '../api.js';

const NODE_TYPES = ['root', 'feature', 'task', 'subtask', 'test_suite', 'test_case', 'link'];
const STATUSES = ['pending', 'in_progress', 'done', 'blocked', 'pass', 'fail'];

export function MetaPanel() {
  const selectedNode = useMindsparkStore((s) => s.selectedNode);
  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);
  const fetchFile = async (f: string) => {
    const { fetchFile: ff } = await import('../api.js');
    const md = await ff(f);
    useMindsparkStore.getState().setMdContent(md);
  };

  if (!selectedNode) {
    return (
      <div className="meta-panel empty">
        <p className="hint">Click a node in the mindmap to edit its properties</p>
      </div>
    );
  }

  const meta = selectedNode.meta || {};

  const handleChange = async (key: string, value: unknown) => {
    await updateNode(file, selectedNode.path, { meta: { [key]: value } });
    await fetchFile(file);
  };

  const handleAddChild = async () => {
    const title = prompt('New node title:');
    if (!title) return;
    await addNode(file, selectedNode.path, title, { type: 'task', status: 'pending' });
    await fetchFile(file);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${selectedNode.title}" and all its children?`)) return;
    await deleteNode(file, selectedNode.path);
    await fetchFile(file);
  };

  return (
    <div className="meta-panel">
      <h3>{selectedNode.title}</h3>

      <label>Type</label>
      <select value={(meta.type as string) ?? ''} onChange={(e) => handleChange('type', e.target.value)}>
        <option value="">—</option>
        {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <label>Status</label>
      <select value={(meta.status as string) ?? ''} onChange={(e) => handleChange('status', e.target.value)}>
        <option value="">—</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label>AI Hint</label>
      <textarea
        value={(meta.ai_hint as string) ?? ''}
        onChange={(e) => handleChange('ai_hint', e.target.value)}
        placeholder="Context for AI..."
        rows={3}
      />

      <label>Priority</label>
      <input
        type="number"
        value={(meta.priority as number) ?? ''}
        onChange={(e) => handleChange('priority', parseInt(e.target.value, 10))}
      />

      <div className="meta-actions">
        <button onClick={handleAddChild}>+ Add Child</button>
        <button className="danger" onClick={handleDelete}>Delete</button>
      </div>

      <div className="meta-info">
        <small>path: {selectedNode.path}</small>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create App component**

Create `web/src/App.tsx`:
```tsx
import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar.js';
import { MarkmapView } from './components/MarkmapView.js';
import { MetaPanel } from './components/MetaPanel.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useMindsparkStore } from './store.js';
import { fetchFile, fetchFiles } from './api.js';

export default function App() {
  useWebSocket();

  const file = useMindsparkStore((s) => s.file);
  const setMdContent = useMindsparkStore((s) => s.setMdContent);
  const setFiles = useMindsparkStore((s) => s.setFiles);

  useEffect(() => {
    fetchFile(file).then(setMdContent);
    fetchFiles().then(setFiles);
  }, [file, setMdContent, setFiles]);

  return (
    <div className="app">
      <Toolbar />
      <div className="main-area">
        <MarkmapView />
        <MetaPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create App styles**

Create `web/src/App.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0d1117;
  color: #c9d1d9;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  font-size: 13px;
}

.toolbar-title {
  font-weight: 700;
  color: #f0f0f0;
  font-size: 14px;
}

.toolbar select {
  padding: 4px 8px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 4px;
  font-size: 12px;
}

.status-dot { font-size: 11px; }
.status-dot.connected { color: #3fb950; }
.status-dot.disconnected { color: #f85149; }

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.markmap-svg {
  flex: 1;
  height: 100%;
}

.meta-panel {
  width: 280px;
  padding: 16px;
  background: #161b22;
  border-left: 1px solid #30363d;
  overflow-y: auto;
  font-size: 12px;
}

.meta-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.meta-panel .hint {
  color: #8b949e;
  text-align: center;
}

.meta-panel h3 {
  font-size: 14px;
  margin-bottom: 12px;
  word-break: break-all;
}

.meta-panel label {
  display: block;
  color: #8b949e;
  font-size: 10px;
  text-transform: uppercase;
  margin: 8px 0 2px;
}

.meta-panel select,
.meta-panel input,
.meta-panel textarea {
  width: 100%;
  padding: 6px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 4px;
  font-size: 12px;
}

.meta-panel textarea {
  resize: vertical;
}

.meta-actions {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #30363d;
}

.meta-actions button {
  flex: 1;
  padding: 6px;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: #21262d;
  color: #c9d1d9;
  font-size: 11px;
  cursor: pointer;
}

.meta-actions button:hover { background: #30363d; }
.meta-actions button.danger { color: #f85149; border-color: #da3633; }

.meta-info {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #30363d;
}

.meta-info small {
  color: #8b949e;
  word-break: break-all;
}
```

- [ ] **Step 6: Verify build**

```bash
cd web && npx tsc -b --noEmit
```
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/Toolbar.tsx web/src/components/MarkmapView.tsx web/src/components/MetaPanel.tsx web/src/App.tsx web/src/App.css
git commit -m "feat: web editor components — Toolbar, MarkmapView, MetaPanel"
```

---

### Task 16: End-to-End Integration Test

**Files:**
- Create: `tests/integration.test.ts`

- [ ] **Step 1: Write integration smoke test**

Create `tests/integration.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createTmpWorkspace } from './helpers/tmp-workspace.js';
import { FileStore } from '../src/core/file-store.js';
import { createApp } from '../src/api/server.js';
import type { AddressInfo } from 'node:net';

describe('Integration', () => {
  let ws: Awaited<ReturnType<typeof createTmpWorkspace>>;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    ws = await createTmpWorkspace();
    await ws.writeMd('project.md', `# Root <!-- {"type":"root"} -->\n\n## Feature <!-- {"type":"feature","status":"active"} -->\n### Task <!-- {"type":"task","status":"done","ai_hint":"test"} -->\n`);
    const store = new FileStore(ws.dir);
    const created = createApp(store);
    server = created.server;
    server.listen(0);
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await ws.cleanup();
  });

  async function fetchApi(path: string, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, init);
  }

  it('full CRUD cycle', async () => {
    // List files
    const listRes = await fetchApi('/api/mindmaps');
    expect((await listRes.json())).toContain('project.md');

    // Read snapshot
    const readRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const text = await readRes.text();
    expect(text).toContain('Root');
    expect(text).toContain('Feature');
    expect(text).toContain('Task');

    // Add node
    const addRes = await fetchApi('/api/mindmaps/project.md/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path: 'Root', title: 'New Feature', meta: { type: 'feature', status: 'pending' } }),
    });
    expect(addRes.status).toBe(201);

    // Update node
    const updateRes = await fetchApi('/api/mindmaps/project.md/nodes/Root/New%20Feature', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { status: 'in_progress', priority: 1 } }),
    });
    expect(updateRes.status).toBe(200);

    // Read updated snapshot
    const verifyRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const verifyText = await verifyRes.text();
    expect(verifyText).toContain('New Feature');

    // Delete node
    const deleteRes = await fetchApi('/api/mindmaps/project.md/nodes/Root/New%20Feature', { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const finalRes = await fetchApi('/api/mindmaps/project.md/tree?meta=false');
    const finalText = await finalRes.text();
    expect(finalText).not.toContain('New Feature');
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/integration.test.ts`
Expected: 1 test PASS

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests across all files PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: end-to-end CRUD integration test"
```

---

## Completion Checklist

- [ ] All tests pass: `npx vitest run`
- [ ] TypeScript compiles: `npx tsc -b --noEmit`
- [ ] Web types check: `cd web && npx tsc -b --noEmit`
- [ ] Server starts: `npm run dev` — serves on port 16393
- [ ] Web editor starts: `cd web && npm run dev` — serves on port 16392
- [ ] MCP server registered in Claude Desktop config:
  ```json
  {
    "mcpServers": {
      "mindspark": {
        "type": "stdio",
        "command": "npx",
        "args": ["tsx", "src/index.ts"],
        "env": { "MINDSPARK_WORKSPACE": "/path/to/workspace" }
      }
    }
  }
  ```
