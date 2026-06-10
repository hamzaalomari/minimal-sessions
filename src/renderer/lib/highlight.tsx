import type { ReactNode } from 'react';

const RE =
  /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|if|else|return|await|async|function|new|import|from|def|for|in|while|class)\b/g;

export function highlightNodes(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} className="c-com">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k++} className="c-str">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} className="c-key">{m[3]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}
