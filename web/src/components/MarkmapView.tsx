import { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { useMindsparkStore } from '../store.js';

const transformer = new Transformer();

export function MarkmapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const mdContent = useMindsparkStore((s) => s.mdContent);
  const selectNode = useMindsparkStore((s) => s.selectNode);

  useEffect(() => {
    if (!svgRef.current) return;

    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 0,
      });
    }

    if (mdContent) {
      const { root } = transformer.transform(mdContent);
      mmRef.current.setData(root);
      mmRef.current.fit();
    }
  }, [mdContent]);

  // Handle node clicks by listening to SVG clicks
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      // Find the closest g element that represents a markmap node
      const nodeEl = target.closest('.markmap-node');
      if (!nodeEl) {
        selectNode(null, null);
        return;
      }
      // Extract title from data attribute or text content
      const title = nodeEl.querySelector('.markmap-node-text')?.textContent;
      if (!title) return;
      // The path and meta aren't directly accessible from the DOM in markmap-view.
      // For v1, we select by title and the MetaPanel will show what it can.
      // The store will have the tree data from the last API call.
      // We set the selectedPath to the title for now; MetaPanel can look up from tree.
      selectNode(title, null);
    };

    svg.addEventListener('click', handleClick);
    return () => svg.removeEventListener('click', handleClick);
  }, [selectNode]);

  return <svg ref={svgRef} className="markmap-svg" />;
}
