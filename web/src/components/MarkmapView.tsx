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

const transformer = new Transformer();

interface Section {
  title: string;
  content: string;
}

interface ParsedMarkdown {
  metaByHeading: Map<string, Record<string, string>>;
  sectionsByHeading: Map<string, Section[]>;
}

function parseMarkdown(mdContent: string): ParsedMarkdown {
  const metaByHeading = new Map<string, Record<string, string>>();
  const sectionsByHeading = new Map<string, Section[]>();
  const lines = mdContent.split('\n');
  let currentHeading = '';
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      const rawHeading = headingMatch[1];
      currentHeading = rawHeading.replace(/\s*<!--.*?-->\s*/, '').trim();

      // Parse meta from HTML comment
      const metaMatch = rawHeading.match(/<!--\s*(\{.*?\})\s*-->/);
      if (metaMatch) {
        try {
          metaByHeading.set(currentHeading, JSON.parse(metaMatch[1]));
        } catch { /* ignore */ }
      }
      if (!sectionsByHeading.has(currentHeading)) {
        sectionsByHeading.set(currentHeading, []);
      }
      continue;
    }

    // Section: **Title** or **Title**: description
    const sectionMatch = line.match(/^\*\*(.+?)\*\*(?::\s*(.*))?$/);
    if (sectionMatch && currentHeading) {
      const sectionTitle = sectionMatch[1].trim();
      let content = (sectionMatch[2] || '').trim();

      if (!content) {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length) {
          const nextLine = lines[j].trim();
          if (
            !nextLine.match(/^#{1,6}\s+/) &&
            !nextLine.match(/^\*\*/) &&
            !nextLine.startsWith('```')
          ) {
            content = nextLine.replace(/^[-*]\s+/, '');
          }
        }
      }

      const sections = sectionsByHeading.get(currentHeading) || [];
      sections.push({ title: sectionTitle, content });
      sectionsByHeading.set(currentHeading, sections);
    }
  }

  return { metaByHeading, sectionsByHeading };
}

/* ---------- helpers ---------- */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Get the display title from a foreignObject (strip HTML comment meta). */
function getNodeTitle(el: Element): string {
  const foreignDiv = el.querySelector('.markmap-foreign div div');
  if (!foreignDiv) return '';
  const raw = foreignDiv.textContent ?? '';
  return raw.replace(/\s*<!--.*?-->\s*/, '').trim();
}

/** Walk DOM and enrich each node's foreignObject with metadata icons and section pills. */
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

    // Use cached data attribute to survive innerHTML rewrites on re-enrich
    let cleanTitle = contentDiv.dataset.heading;
    if (!cleanTitle) {
      const raw = contentDiv.textContent ?? '';
      cleanTitle = raw.replace(/\s*<!--.*?-->\s*/, '').trim();
      contentDiv.dataset.heading = cleanTitle;
    }
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

/** Build a map from markmap data-path (e.g. "1.2.3") to full heading path,
 *  by walking all .markmap-node elements in the SVG after rendering. */
function buildPathMapFromDOM(svg: SVGSVGElement): Map<string, string> {
  const map = new Map<string, string>();
  const nodes = svg.querySelectorAll('.markmap-node');
  const entries: { dp: string; title: string }[] = [];

  for (const node of nodes) {
    const dp = (node as HTMLElement).dataset.path ?? '';
    const title = getNodeTitle(node);
    if (dp && title) {
      entries.push({ dp, title });
    }
  }

  entries.sort((a, b) => {
    const depthA = a.dp.split('.').length;
    const depthB = b.dp.split('.').length;
    return depthA - depthB;
  });

  for (const { dp, title } of entries) {
    const segments = dp.split('.');
    const parentSegments = segments.slice(0, -1);
    const parentDp = parentSegments.join('.');
    const parentPath = parentDp ? map.get(parentDp) ?? '' : '';
    map.set(dp, parentPath ? `${parentPath}/${title}` : title);
  }

  return map;
}

/* ---------- component ---------- */

export function MarkmapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const pathMapRef = useRef<Map<string, string>>(new Map());
  const metaMapRef = useRef<Map<string, Record<string, string>>>(new Map());
  const sectionsMapRef = useRef<Map<string, Section[]>>(new Map());
  const expandedNodesRef = useRef<Set<string>>(new Set());
  const mdContent = useMindsparkStore((s) => s.mdContent);
  const selectNode = useMindsparkStore((s) => s.selectNode);

  useEffect(() => {
    if (!svgRef.current) return;

    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        autoFit: false,
        duration: 0,
      });
      // Disable d3-zoom's dblclick handler so our own dblclick→MetaPanel works
      const svgEl = svgRef.current as any;
      if (svgEl?.__zoom) {
        const origFilter = svgEl.__zoom.filter;
        svgEl.__zoom.filter((event: any) => {
          if (event.type === 'dblclick') return false;
          return origFilter ? origFilter(event) : true;
        });
      }
    }

    if (mdContent) {
      const { root } = transformer.transform(mdContent);
      mmRef.current.setData(root);
      mmRef.current.fit();

      const { metaByHeading, sectionsByHeading } = parseMarkdown(mdContent);
      metaMapRef.current = metaByHeading;
      sectionsMapRef.current = sectionsByHeading;

      expandedNodesRef.current = new Set();
      pathMapRef.current = buildPathMapFromDOM(svgRef.current);
      enrichNodes(svgRef.current, metaByHeading, sectionsByHeading, expandedNodesRef.current);
    }
  }, [mdContent]);

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
      const svg = svgRef.current;
      if (svg) {
        enrichNodes(svg, metaMapRef.current, sectionsMapRef.current, expanded);
      }
    }
  }, [selectNode]);

  const handleDblClick = useCallback((e: MouseEvent) => {
    const target = e.target as SVGElement;
    const nodeEl = target.closest('.markmap-node') as HTMLElement | null;
    if (!nodeEl) return;

    const dataPath = nodeEl.dataset.path ?? '';
    const path = pathMapRef.current.get(dataPath) ?? '';
    if (path) {
      const leafTitle = path.split('/').pop() ?? path;
      const meta = metaMapRef.current.get(leafTitle) ?? null;
      const sections = sectionsMapRef.current.get(leafTitle) ?? [];
      selectNode(path, meta, sections);
    }
  }, [selectNode]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('click', handleClick);
    svg.addEventListener('dblclick', handleDblClick);
    return () => {
      svg.removeEventListener('click', handleClick);
      svg.removeEventListener('dblclick', handleDblClick);
    };
  }, [handleClick, handleDblClick]);

  return <svg ref={svgRef} className="markmap-svg" />;
}
