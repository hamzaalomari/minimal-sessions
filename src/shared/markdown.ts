/**
 * Minimal markdown → Block[] converter for assistant text content.
 *
 * Handles:
 *   - Fenced code blocks  ```lang\n...\n```
 *   - ATX headers         #, ##, ### → 'h'
 *   - Unordered lists     -, *, + → 'ul'
 *   - Ordered lists       1., 2. → 'ul' (numbers stripped)
 *   - GFM tables          | h | h |\n|---|---|\n| c | c |
 *   - Paragraphs          separated by blank lines
 *
 * Inline formatting (bold, inline code, italic) stays in the paragraph text
 * and is handled by `renderInline()` in the renderer.
 */

import type { Block } from '@shared/types';

const FENCE_RE = /^```(\S*)\s*$/;
const HEADER_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+\.\s+(.*)$/;
/** A line that contains at least one pipe — candidate table row. */
const TABLE_LIKE_RE = /\|/;
/** GFM table separator: `|---|:--:|---:|`, with each segment >= 3 dashes. */
const TABLE_SEP_RE = /^\s*\|?\s*:?-{3,}:?(\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/;

function splitRow(line: string): string[] {
  // Strip outer pipes, then split on `|` and trim.
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split('|').map((c) => c.trim());
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip blank lines between blocks.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] || '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ type: 'code', lang, code: body.join('\n') });
      continue;
    }

    // Header.
    const header = line.match(HEADER_RE);
    if (header) {
      blocks.push({ type: 'h', text: header[2]!.trim() });
      i++;
      continue;
    }

    // GFM table: a header row followed by a separator row.
    if (TABLE_LIKE_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]!)) {
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2; // skip header + separator
      while (i < lines.length && TABLE_LIKE_RE.test(lines[i]!) && lines[i]!.trim() !== '') {
        rows.push(splitRow(lines[i]!));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // List (consume consecutive list lines).
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(UL_RE) ?? lines[i]!.match(OL_RE);
        if (!m) break;
        items.push(m[1]!.trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Paragraph: collect lines until blank or a special start.
    const para: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i]!;
      if (next.trim() === '') break;
      if (FENCE_RE.test(next) || HEADER_RE.test(next)) break;
      if (UL_RE.test(next) || OL_RE.test(next)) break;
      // Don't suck the table header line into the previous paragraph.
      if (
        TABLE_LIKE_RE.test(next) &&
        i + 1 < lines.length &&
        TABLE_SEP_RE.test(lines[i + 1]!)
      ) {
        break;
      }
      para.push(next);
      i++;
    }
    blocks.push({ type: 'p', text: para.join('\n') });
  }

  return blocks;
}
