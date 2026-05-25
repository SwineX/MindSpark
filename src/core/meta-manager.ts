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

export function writeMeta(lineOrTitle: string, meta: MetaRecord): string {
  const depth = countHeadingDepth(lineOrTitle);
  const hashes = '#'.repeat(depth);
  const json = JSON.stringify(meta);
  const cleanLine = stripComment(lineOrTitle);
  const headingText = cleanLine.replace(/^#+\s*/, '');
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
  // Default to depth 2 (##) for titles without heading markers,
  // which is the most common heading level in Markdown documents.
  return match ? match[1].length : 2;
}
