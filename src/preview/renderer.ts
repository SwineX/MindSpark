export function generatePreviewHTML(markdown: string, title: string = 'Mindmap'): string {
  const escapedMd = markdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/<\/script>/g, '<\\/script>');

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
