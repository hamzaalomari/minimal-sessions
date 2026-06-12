import type { ReactNode } from 'react';
import { AnsiUp } from 'ansi_up';

/** Single shared AnsiUp instance — its only mutable state is the current
 *  SGR style, which is reset before each call. Avoids constructing a new
 *  parser per terminal render. */
const conv = new AnsiUp();
conv.use_classes = false;
conv.escape_html = true;

// eslint-disable-next-line no-control-regex -- ANSI escape literally starts with \x1b
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/;

/** Common git/npm/test output patterns that have no ANSI codes but still
 *  benefit from coloring. Each pattern produces a span class so the CSS
 *  can map to theme colors. */
const PATTERNS: ReadonlyArray<{ re: RegExp; cls: string }> = [
  // diff-style additions / removals
  { re: /^(\+\+\+ .*|--- .*)$/gm, cls: 'ansi-cyan' },
  { re: /^(\+(?!\+).*)$/gm, cls: 'ansi-green' },
  { re: /^(-(?!-).*)$/gm, cls: 'ansi-red' },
  // git diff hunk header
  { re: /^(@@ .* @@.*)$/gm, cls: 'ansi-magenta' },
  // git status / log staples
  { re: /^(commit [0-9a-f]{7,40})$/gm, cls: 'ansi-yellow' },
  { re: /^(Author: .*)$/gm, cls: 'ansi-faint' },
  { re: /^(Date: .*)$/gm, cls: 'ansi-faint' },
  // npm / test result phrases
  { re: /\b(PASS|passed|✓)\b/gi, cls: 'ansi-green' },
  { re: /\b(FAIL|failed|✗|✘|Error)\b/gi, cls: 'ansi-red' },
  { re: /\b(WARN|warning)\b/gi, cls: 'ansi-yellow' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Wrap matched substrings in <span class="..."> while keeping the rest of
 *  the text escaped. Runs patterns sequentially over the rendered HTML; later
 *  patterns operate on the still-plain segments only (skipping any tag we've
 *  already inserted). */
function applyPatterns(html: string): string {
  // Strategy: split the html on existing tags, only transform the plain
  // segments, then re-join. This keeps already-colored ANSI spans intact.
  const TAG = /(<[^>]+>)/g;
  const parts = html.split(TAG);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue; // tag — skip
    let segment = parts[i]!;
    for (const { re, cls } of PATTERNS) {
      re.lastIndex = 0;
      segment = segment.replace(re, `<span class="${cls}">$1</span>`);
    }
    parts[i] = segment;
  }
  return parts.join('');
}

/** Convert raw terminal/bash output into a single React node containing
 *  spans for ANSI color codes (via ansi_up) plus pattern-based fallback
 *  highlighting for plain git/diff/test output. */
export function renderAnsi(text: string): ReactNode {
  let html: string;
  if (ANSI_RE.test(text)) {
    // ansi_up's ansi_to_html also handles HTML escaping internally.
    html = conv.ansi_to_html(text);
  } else {
    html = escapeHtml(text);
  }
  html = applyPatterns(html);
  return (
    <span
      className="ansi-output"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
