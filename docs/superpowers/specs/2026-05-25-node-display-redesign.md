# Node Display Redesign — Design Spec

**Date**: 2026-05-25
**Status**: approved

## Overview

Redesign how nodes render inside the markmap SVG view. Replace emoji-based indicators with a clean tag system, add collapsible sections, and introduce a centralized theme config.

## Design Decisions

### 1. Type Tags — Solid Background, Small & Refined

- Solid background color (not outline), white text, uppercase, small font (0.58em)
- Each type has its own color, defined in `theme.ts`
- Labels are short: `feat`, `task`, `sub`, `suite`, `case`, `bug`, `link`

### 2. Status — Bold Colored Text Only

- No background, no border — just bold colored text
- Reduces visual clutter (avoids "too many boxes" problem)
- Status dot (colored circle) remains as before

### 3. Sections — Collapsible, Expand Upward

- Sections show **above** the node title when expanded
- Section titles have **colored borders** (no background fill) based on keyword mapping
- Click anywhere on a node to toggle collapse/expand
- CSS `max-height` transition for smooth animation
- After toggle, call `mm.fit()` to re-center
- Default state: **collapsed** (clean overview)

### 4. Section Color Mapping (Keyword → Border Color)

| Keyword | Color | Hex |
|---------|-------|-----|
| Code | blue | #7b8cf0 |
| Criteria | green | #00b894 |
| Issues | red | #e07070 |
| Notes | gray | #b2bec3 |
| (other) | muted | #8888b0 |

### 5. AI Hint — Breathing Dot + Hover Tooltip

- Small dot (5px) with `box-shadow` pulse animation (2s cycle)
- On hover: browser-native `title` tooltip showing hint text
- Color from theme config

### 6. Theme Config — `web/src/theme.ts`

Single file exporting all color/label mappings:

```ts
export const theme = {
  type: { colors: {...}, labels: {...} },
  status: { colors: {...} },
  section: { colors: {...}, defaultColor: '...' },
  aiHint: { dotColor: '...' },
};
```

Both `MarkmapView.tsx` (inline style strings) and `App.css` (CSS custom properties) read from this file. To customize for a different project, edit only `theme.ts`.

## Files Changed

| File | Change |
|------|--------|
| `web/src/theme.ts` | **New** — centralized theme config |
| `web/src/components/MarkmapView.tsx` | Rewrite `enrichNodes()` — new tag styles, collapsible sections, AI dot |
| `web/src/App.css` | Add CSS animations (`@keyframes breathe`), section collapse classes |

## Technical Approach — Collapsible Sections

- Store collapse state in a `Set<string>` of expanded node titles (or data-paths)
- Sections always in the DOM; toggled via `max-height` + `overflow: hidden`
- Click handler: detect node, toggle its entry in the Set, re-run `enrichNodes()`
- After enrich, call `mm.fit()` to re-center the view

## Out of Scope

- Persisting collapse state across sessions
- Nested section types
- Drag-and-drop reordering of sections
