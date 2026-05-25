# Node Display Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign mindmap node rendering — solid type tags, bold-text status, collapsible sections with colored borders, breathing AI hint dot, and a centralized theme config.

**Architecture:** New `web/src/theme.ts` exports color/label mappings consumed by `MarkmapView.tsx` (inline SVG styles) and `App.css` (CSS custom properties via `:root` injection). Collapse state held in a `Set<string>` ref; toggling re-runs `enrichNodes()` then calls `mm.fit()` to re-center.

**Tech Stack:** React, TypeScript, markmap-view, Zustand

---

### Task 1: Create centralized theme config

**Files:**
- Create: `web/src/theme.ts`

- [ ] **Step 1: Write the theme module**

```typescript
// web/src/theme.ts

/** Per-type background fill color (solid tag). */
export const TYPE_COLORS: Record<string, string> = {
  root: '#636e72',
  feature: '#7b8cf0',
  task: '#e1a82a',
  subtask: '#5a9e6f',
  test_suite: '#a55db5',
  test_case: '#5ea3b5',
  bug: '#e07070',
  link: '#5e81b5',
};

/** Per-type display label. */
export const TYPE_LABELS: Record<string, string> = {
  root: 'root',
  feature: 'feat',
  task: 'task',
  subtask: 'sub',
  test_suite: 'suite',
  test_case: 'case',
  bug: 'bug',
  link: 'link',
};

/** Per-status text color. */
export const STATUS_COLORS: Record<string, string> = {
  done: '#00b894',
  in_progress: '#fdcb6e',
  pending: '#b2bec3',
  pass: '#00b894',
  fail: '#e17055',
  blocked: '#e17055',
};

/** Section keyword → border color. */
export const SECTION_COLORS: Record<string, string> = {
  Code: '#7b8cf0',
  Criteria: '#00b894',
  Issues: '#e07070',
  Notes: '#b2bec3',
};
export const SECTION_DEFAULT_COLOR = '#8888b0';

/** AI hint breathing dot color. */
export const AI_HINT_DOT_COLOR = '#7b8cf0';
```

- [ ] **Step 2: Commit**

```bash
git add web/src/theme.ts
git commit -m "feat: add centralized theme config for node display"
```

---

### Task 2: Add CSS animations and section styles

**Files:**
- Modify: `web/src/App.css`

- [ ] **Step 1: Add breathing keyframe and section classes**

Append to the end of `web/src/App.css`:

```css
/* ── Node enrichment (mindmap foreignObject) ── */

@keyframes mindspark-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(123, 140, 240, 0.5); }
  50% { box-shadow: 0 0 0 5px rgba(123, 140, 240, 0); }
}

.mindspark-sections {
  margin-bottom: 5px;
  padding-left: 8px;
  border-left: 2px solid #2a2a50;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  transition: max-height 0.25s ease, opacity 0.25s ease, margin-bottom 0.25s ease;
}

.mindspark-sections.expanded {
  max-height: 200px;
  opacity: 1;
  margin-bottom: 5px;
}

.mindspark-sections.collapsed {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  border-left-width: 0;
  padding-left: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/App.css
git commit -m "style: add breathing keyframe and section collapse CSS classes"
```

---

### Task 3: Rewrite enrichNodes() with new tag styles

**Files:**
- Modify: `web/src/components/MarkmapView.tsx`

- [ ] **Step 1: Update imports — add theme imports, remove old inline constants**

Replace lines 1-27 (imports + old constants) with:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { useMindsparkStore } from '../store.js';
import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_COLORS,
  SECTION_COLORS,
  SECTION_DEFAULT_COLOR,
  AI_HINT_DOT_COLOR,
} from '../theme.js';
```

Delete lines 10-27 (old `STATUS_COLORS` and `TYPE_LABELS` constants — they're now in theme.ts).

- [ ] **Step 2: Rewrite enrichNodes() function body**

Replace the `enrichNodes()` function (lines 117-187) with:

```typescript
/** Walk DOM and enrich each node's foreignObject with tags, sections, and AI hint. */
function enrichNodes(
  svg: SVGSVGElement,
  metaByHeading: Map<string, Record<string, string>>,
  sectionsByHeading: Map<string, Section[]>,
  expandedNodes: Set<string>,
) {
  const allNodes = svg.querySelectorAll('.markmap-node');
  for (const nodeEl of allNodes) {
    const contentDiv = nodeEl.querySelector('.markmap-foreign div div') as HTMLElement | null;
    if (!contentDiv) continue;

    const raw = contentDiv.textContent ?? '';
    const cleanTitle = raw.replace(/\s*<!--.*?-->\s*/, '').trim();
    const meta = metaByHeading.get(cleanTitle) || {};
    const dataPath = (nodeEl as HTMLElement).dataset.path ?? '';
    const isExpanded = expandedNodes.has(dataPath);
    const nodeSections = sectionsByHeading.get(cleanTitle);
    const hasSections = nodeSections && nodeSections.length > 0;

    /* --- sections block (above title) --- */
    let sectionsHtml = '';
    if (hasSections) {
      const expandedClass = isExpanded ? 'expanded' : 'collapsed';
      sectionsHtml =
        `<div class="mindspark-sections ${expandedClass}">`;
      for (const sec of nodeSections!) {
        const secColor = SECTION_COLORS[sec.title] || SECTION_DEFAULT_COLOR;
        sectionsHtml +=
          `<div style="display:flex;align-items:baseline;gap:6px;font-size:0.68em;">` +
          `<span style="font-weight:600;font-size:0.85em;padding:0 5px;border-radius:3px;border:1.5px solid ${secColor};color:${secColor};background:transparent;flex-shrink:0;">${escapeHtml(sec.title)}</span>` +
          (sec.content
            ? `<span style="color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sec.content)}</span>`
            : '') +
          `</div>`;
      }
      sectionsHtml += '</div>';
    }

    /* --- header row --- */
    const headerParts: string[] = [];

    // status dot
    if (meta.status) {
      const color = STATUS_COLORS[meta.status] || STATUS_COLORS.pending;
      headerParts.push(
        `<span style="display:inline-block;width:7px;height:7px;background:${color};border-radius:50%;flex-shrink:0;"></span>`,
      );
    }

    // type tag — solid bg, small, uppercase
    if (meta.type && TYPE_LABELS[meta.type]) {
      const bg = TYPE_COLORS[meta.type] || '#636e72';
      headerParts.push(
        `<span style="font-size:0.58em;padding:2px 6px;border-radius:3px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;color:#fff;background:${bg};flex-shrink:0;">${TYPE_LABELS[meta.type]}</span>`,
      );
    }

    // title
    headerParts.push(`<span style="font-weight:600;">${escapeHtml(cleanTitle)}</span>`);

    // status text — bold colored, no box
    if (meta.status) {
      const color = STATUS_COLORS[meta.status] || STATUS_COLORS.pending;
      headerParts.push(
        `<span style="font-weight:700;color:${color};font-size:0.7em;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(meta.status.replace(/_/g, ' '))}</span>`,
      );
    }

    // AI hint — breathing dot
    if (meta.ai_hint) {
      headerParts.push(
        `<span title="${escapeHtml(meta.ai_hint)}" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${AI_HINT_DOT_COLOR};flex-shrink:0;cursor:help;animation:mindspark-breathe 2s ease-in-out infinite;"></span>`,
      );
    }

    // collapse toggle arrow (only if node has sections)
    if (hasSections) {
      const arrow = isExpanded ? '▲' : '▼';
      headerParts.push(
        `<span style="font-size:0.6em;color:#6868a0;margin-left:auto;cursor:pointer;user-select:none;flex-shrink:0;">${arrow}</span>`,
      );
    }

    const headerHtml = `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${headerParts.join('')}</div>`;

    contentDiv.innerHTML = sectionsHtml + headerHtml;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MarkmapView.tsx
git commit -m "feat: rewrite enrichNodes with new tag styles, sections, AI hint dot"
```

---

### Task 4: Add collapse toggle logic to MarkmapView component

**Files:**
- Modify: `web/src/components/MarkmapView.tsx`

- [ ] **Step 1: Add expandedNodes ref and update enrichNodes calls**

In the `MarkmapView` component (around line 223), add a ref:

```typescript
const expandedNodesRef = useRef<Set<string>>(new Set());
```

Update the `useEffect` that calls `enrichNodes` (line 254) — pass `expandedNodesRef.current`:

```typescript
enrichNodes(svgRef.current, metaByHeading, sectionsByHeading, expandedNodesRef.current);
```

- [ ] **Step 2: Update handleClick to toggle sections and re-render**

Replace the `handleClick` function (lines 258-274) with:

```typescript
const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as SVGElement;
    const nodeEl = target.closest('.markmap-node') as HTMLElement | null;
    if (!nodeEl) {
      selectNode(null, null, []);
      return;
    }

    const dataPath = nodeEl.dataset.path ?? '';
    const path = pathMapRef.current.get(dataPath) ?? '';

    // Toggle section expand/collapse
    const leafTitle = path ? path.split('/').pop() ?? path : '';
    const nodeSections = sectionsMapRef.current.get(leafTitle);
    if (nodeSections && nodeSections.length > 0) {
      const expanded = expandedNodesRef.current;
      if (expanded.has(dataPath)) {
        expanded.delete(dataPath);
      } else {
        expanded.add(dataPath);
      }
      // Re-enrich to update section visibility
      const svg = svgRef.current;
      if (svg) {
        enrichNodes(svg, metaMapRef.current, sectionsMapRef.current, expanded);
        mmRef.current?.fit();
      }
    }

    // Select node for meta panel
    if (path) {
      const meta = metaMapRef.current.get(leafTitle) ?? null;
      const sections = nodeSections ?? [];
      selectNode(path, meta, sections);
    }
  }, [selectNode]);
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MarkmapView.tsx
git commit -m "feat: add collapsible sections toggle on node click"
```

---

### Task 5: Verify end-to-end in browser

**Files:**
- No file changes — verification only

- [ ] **Step 1: Start backend and frontend**

```bash
npx tsx dev-server.ts
```
In a separate terminal:
```bash
cd web && npx vite --port 16392
```

- [ ] **Step 2: Open in Chrome DevTools MCP and verify**

Navigate to `http://localhost:16392` and check:

1. **Type tags** — solid background, small uppercase, correct colors per type
2. **Status** — bold colored text, no background/border
3. **Status dot** — still present, same as before
4. **Sections collapsed by default** — only ▼ arrow visible on nodes with sections
5. **Click node to expand** — sections appear above title with colored borders, arrow changes to ▲
6. **Section colors** — Code=blue, Criteria=green, Issues=red, Notes=gray
7. **AI hint dot** — small breathing dot with pulse animation, hover shows tooltip
8. **MetaPanel still works** — clicking a node still opens the editor panel

- [ ] **Step 3: Fix any visual issues found during testing**

- [ ] **Step 4: Final commit if changes needed**

```bash
git add -A
git commit -m "fix: visual polish from browser verification"
```
