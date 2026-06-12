import type { ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';

// Hand-pick the languages we expect Claude to emit. Each registered
// language adds a few KB; bundling everything (`highlight.js/lib/common`)
// would pull in ~50 grammars. This set covers what we see in practice
// without bloat.
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('go', go);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  zsh: 'bash',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  yml: 'yaml',
  toml: 'ini',
  html: 'xml',
  svg: 'xml',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  '': 'plaintext',
};

function resolveLang(lang: string): string {
  const k = lang.toLowerCase();
  return ALIASES[k] ?? k;
}

/** Highlight `code` as `lang` and return a single ReactNode whose innerHTML
 *  is the hljs-tokenized output. hljs writes its own `hljs-*` class names —
 *  the renderer's CSS maps those to our `--accent` palette. */
export function highlightNodes(code: string, lang = 'plaintext'): ReactNode[] {
  const resolved = resolveLang(lang);
  let html: string;
  try {
    if (hljs.getLanguage(resolved)) {
      html = hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
    } else {
      html = hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value;
    }
  } catch {
    html = escapeHtml(code);
  }
  return [
    <span
      key="hl"
      className={`hljs language-${resolved}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />,
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
