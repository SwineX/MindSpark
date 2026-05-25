# Mindspark — AI-Driven Knowledge Mindmap System

## Overview

Mindspark converts Markdown files into interactive mindmaps (via markmap), augmented with per-node structured metadata (type, status, AI hints, custom fields). It serves as a living knowledge base that AI agents read from and write to — the mindmap is both the documentation and the task dashboard.

### Core Scenarios

1. **Project knowledge base** — requirements, architecture, decisions organized as mindmaps. AI reads for context before development.
2. **AI execution tracking** — AI updates node status/metadata as it works (pending → in_progress → done), forming a live task board.
3. **Test case management** — executable, repeatable test behavior trees with pass/fail status and auto-execution flags.

### Design Principles

- **Markdown is the single source of truth** — no separate metadata files
- **markmap-native compatible** — all existing markmap tools work without modification
- **Minimal custom UI** — lightweight web editor only for metadata editing
- **AI-first** — MCP tools optimized for LLM consumption (snapshot-style flat output)

---

## Architecture

### Unified TypeScript Server

A single Node.js process provides three interfaces sharing the same Core Engine:

```
┌─ Claude Desktop ─┐     ┌─ Browser ────────────────┐
│  MCP Client       │     │  Web Editor              │
│  (stdio)          │     │  (REST + WebSocket)      │
└───────┬───────────┘     └──────────┬───────────────┘
        │ stdio                      │ HTTP / WS
        ▼                            ▼
┌──────────────────────────────────────────┐
│        Unified TS Server                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ MCP      │ │ REST API │ │ WS       │ │
│  │ Handler  │ │ /api/*   │ │          │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       └────────────┼────────────┘        │
│                    ▼                      │
│  ┌──────────────────────────────────┐    │
│  │        Core Engine               │    │
│  │  ┌────────────┐ ┌──────────────┐ │    │
│  │  │ MD Parser  │ │ Meta Manager │ │    │
│  │  │(markmap-lib)│ │(HTML comment │ │    │
│  │  │            │ │ parse/write) │ │    │
│  │  └────────────┘ └──────────────┘ │    │
│  │  ┌────────────────────────────┐  │    │
│  │  │   File Store + Link Resolver│  │    │
│  │  └────────────────────────────┘  │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Server | TypeScript + Node.js | Single language, direct markmap-lib import |
| MCP | @modelcontextprotocol/sdk | Standard MCP stdio transport |
| MD Parser | markmap-lib | Official package, transform() + tree output |
| REST/WS | Express/Fastify + ws | Lightweight HTTP + WebSocket |
| Frontend | React + Vite | Familiar from Pilotest |
| Rendering | markmap-view | Official interactive SVG renderer |
| State | Zustand | Lightweight, consistent with Pilotest |
| Data | File system workspace/*.md | Git-friendly, no database |

---

## Metadata Scheme

### Encoding: HTML Comments

Metadata is stored as JSON inside HTML comments on each heading line. markmap natively ignores HTML comments, so the mindmap renders cleanly in all markmap tools (VSCode plugin, CLI, REPL, MCP server).

```
## 登录模块 <!-- {"type":"task","status":"done","ai_hint":"JWT+Redis"} -->
```

### Standard Meta Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Node type: root, feature, task, subtask, test_suite, test_case, link |
| `status` | string | pending, in_progress, done, blocked, pass, fail |
| `ai_hint` | string | Context/prompt for AI when working on this node |
| `priority` | number | Priority order (1 = highest) |
| `auto_exec` | boolean | (test nodes) Whether AI should auto-execute |
| `target` | string | (link nodes) Target file path for cross-file links |

Custom fields can be added freely. mergeMeta preserves unknown keys.

---

## MCP Tools

### Design: Snapshot-Style Flat Output

Inspired by Chrome DevTools `take_snapshot`: flat indented text instead of nested JSON. Depth conveyed by 2-space indentation. No `#` heading markers needed.

### Tool List

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_mindmaps` | — | List all .md files in workspace |
| `read_mindmap` | file, path?, depth?, include_meta?, include_body?, follow_links? | Flat indented tree output |
| `add_node` | file, parent_path, title, meta?, body? | Add child heading under parent |
| `update_node` | file, path, title?, meta?, body? | Update heading text or merge metadata |
| `delete_node` | file, path | Remove heading and its subtree |
| `move_node` | file, path, new_parent_path, position? | Move subtree to new parent |
| `preview` | file, open? | Generate interactive HTML, optionally auto-open browser |

### read_mindmap Output Format

```
read_mindmap({file:"project.md", include_meta:true})

项目总览 {"type":"root"}
  用户系统 {"type":"feature","status":"active"}
    登录模块 {"type":"task","status":"done","ai_hint":"JWT+Redis"}
      前端页面 {"type":"subtask","status":"done"}
      后端API {"type":"subtask","status":"in_progress"}
    注册模块 {"type":"task","status":"pending"}
  测试用例 {"type":"test_suite","auto_exec":true}
    登录-正常流程 {"type":"test_case","status":"pass"}
    登录-密码错误 {"type":"test_case","status":"fail"}
```

With `include_body:true`, body text appears with `|` prefix + extra indentation after each node.

### Node Addressing: Heading Path

Nodes are identified by their heading path (slash-separated titles). No UUID needed.

```
path: "用户系统/登录模块/前端页面"
path: "测试用例"  (top-level child)
```

Constraint: sibling headings must have unique names under the same parent.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mindmaps` | List all .md files |
| `GET` | `/api/mindmaps/:file` | Get raw MD content |
| `GET` | `/api/mindmaps/:file/tree?path=&depth=&meta=&body=` | Get structured tree (same as read_mindmap) |
| `POST` | `/api/mindmaps/:file/nodes` | Add node `{parent_path, title, meta?}` |
| `PUT` | `/api/mindmaps/:file/nodes/:path` | Update node `{title?, meta?}` |
| `DELETE` | `/api/mindmaps/:file/nodes/:path` | Delete node and subtree |
| `PUT` | `/api/mindmaps/:file/nodes/:path/move` | Move node `{new_parent_path}` |
| `GET` | `/ws` | WebSocket for file change events |

### WebSocket Events

```json
{"type":"node_updated","file":"project.md","path":"用户系统/登录","changes":{"status":"done"}}
{"type":"node_added","file":"project.md","parent_path":"用户系统","title":"权限管理"}
{"type":"node_deleted","file":"project.md","path":"用户系统/废弃模块"}
{"type":"node_moved","file":"project.md","path":"登录","new_parent_path":"已废弃"}
{"type":"file_created","file":"new-doc.md"}
{"type":"file_deleted","file":"old-doc.md"}
```

---

## Web Editor

### Layout

```
┌─ Toolbar ──────────────────────────────────┐
│ 📊 project.md    ● connected    + Add Root │
├──────────────────────┬──────────────────────┤
│                      │  NODE PROPERTIES     │
│   markmap-view       │  ────────────────    │
│   interactive SVG    │  title: 登录模块     │
│                      │  type:  [task  ▾]    │
│   click node →       │  status:[done  ▾]    │
│   edit in panel      │  ai_hint: [...]      │
│                      │  priority: [1]       │
│                      │                      │
│                      │  [+ Add Child]       │
│                      │  [🗑 Delete]         │
│                      │                      │
│                      │  path: .../登录模块  │
│                      │  children: 2         │
└──────────────────────┴──────────────────────┘
```

### Components

- **Toolbar** — filename, connection status, add-root-node button
- **MarkmapView** — markmap-view rendering, click-on-node event delegation
- **MetaPanel** — form for editing selected node's type, status, ai_hint, and custom fields; Add Child / Delete buttons

### Data Flow

1. **Load**: GET `/api/mindmaps/:file` → raw MD → markmap-view renders; HTML comments parsed into node data
2. **User edit**: Modify MetaPanel form → PUT `/api/mindmaps/:file/nodes/:path` → server rewrites HTML comment → WS broadcast → all clients refresh
3. **AI edit**: Claude via MCP `update_node` → server updates MD file → WS broadcast → Web Editor auto-refreshes
4. **Node CRUD**: Add Child/Delete → POST/DELETE → server modifies heading structure → WS broadcast

### Tech

- React + Vite + markmap-view + Zustand + WebSocket
- Dev server on port 16392, proxies `/api` and `/ws` to backend

---

## Core Engine

### Layers

1. **Markdown Parser** — wraps markmap-lib `transform()`, extracts HTML comment metadata per node
2. **Metadata Manager** — `parseMeta(line)` → JSON, `writeMeta(json)` → HTML comment, `mergeMeta(old, new)` → merged (preserves unknown keys)
3. **File Store** — workspace/*.md read/write with atomic writes (write to temp → rename)
4. **Link Resolver** — parses `[text](./path.md)` syntax in link-type nodes, resolves cross-file references

### Metadata Merge Logic

```
update_node({meta: {status: "done"}})  // only replaces "status", keeps "type", "ai_hint", etc.
update_node({meta: {ai_hint: null}})   // null value removes the key
```

---

## Multi-File Linking

Nodes with `type: "link"` reference other .md files via standard Markdown link syntax:

```markdown
### 📎 [架构设计](./architecture.md) <!-- {"type":"link","target":"architecture.md"} -->
```

### Link Resolver Behavior

| Scenario | Behavior |
|----------|----------|
| `read_mindmap` encounters link node | Shows link with `{"type":"link","target":"..."}`, does not expand |
| `read_mindmap({follow_links: true})` | Inlines target file content as children of the link node |
| Web Editor clicks link node | Switches view to target file |
| AI needs full module context | `read_mindmap({path:"用户系统", follow_links:true})` gets complete context |

Recursive links are prevented (each file expanded at most once per read).

---

## Project Structure

```
mindspark/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Unified entry (MCP + HTTP + WS)
│   ├── core/
│   │   ├── parser.ts         # MD parsing + HTML comment extraction
│   │   ├── meta-manager.ts   # Metadata read/write/merge
│   │   ├── file-store.ts     # File system operations + atomic write
│   │   └── link-resolver.ts  # Cross-file MD link resolution
│   ├── mcp/
│   │   ├── server.ts         # MCP stdio transport
│   │   └── tools/            # 7 tool handlers
│   ├── api/
│   │   ├── routes.ts         # REST routes
│   │   └── ws.ts             # WebSocket manager
│   └── preview/
│       └── renderer.ts       # Generate standalone markmap HTML
├── web/                      # Frontend (React + Vite)
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── Toolbar.tsx
│       │   ├── MarkmapView.tsx
│       │   └── MetaPanel.tsx
│       └── hooks/
│           ├── useWebSocket.ts
│           └── useMindmap.ts
└── workspace/                # User data (can be a separate git repo)
    ├── project.md
    └── tests/
        ├── auth-tests.md
        └── api-tests.md
```

---

## Key Design Decisions

1. **HTML comments vs YAML frontmatter**: HTML comments are natively ignored by ALL markmap tools (VSCode, CLI, REPL, MCP). Per-section YAML `---` blocks render as horizontal rules in markmap.
2. **Flat text output vs nested JSON**: The Chrome DevTools `take_snapshot` flat-indentation pattern uses 60-80% fewer tokens for equivalent information and is easier for LLMs to parse.
3. **Heading path vs UUID**: Paths are human-readable, AI-friendly, and survive file edits. The uniqueness constraint (no duplicate siblings) is enforced by both server and editor.
4. **Single TS server vs TS+Python**: Direct `markmap-lib` import eliminates dual-language parsing logic. Node.js is the natural environment for MCP servers.
5. **File system vs database**: Markdown files are the data. Git tracks history. No migration scripts. Works with any text editor.

---

## Out of Scope (v1)

- Multi-user collaboration / auth
- Real-time collaborative editing (CRDT/OT)
- Plugin system
- Mobile app
- Database backends (PostgreSQL, etc.)
- PDF/docx export
