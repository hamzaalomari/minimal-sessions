import type { ReactNode } from 'react';

// Bold (**text**), italic (*text* or _text_), inline code (`text`),
// markdown link ([text](url)), and bare http(s) URLs (auto-linked).
const RE =
  /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()'"]+))/g;

/** Trim trailing punctuation that's almost certainly sentence terminators,
 *  not part of the URL. (Closing parens are handled by the regex itself.) */
function cleanBareUrl(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = '';
  while (url.length > 0 && /[.,;:!?]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

function renderSegment(text: string, baseKey: number): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] != null) {
      out.push(<strong key={`${baseKey}-${k++}`}>{m[2]}</strong>);
    } else if (m[3] != null) {
      out.push(<em key={`${baseKey}-${k++}`}>{m[3]}</em>);
    } else if (m[4] != null) {
      out.push(<em key={`${baseKey}-${k++}`}>{m[4]}</em>);
    } else if (m[5] != null) {
      out.push(
        <code key={`${baseKey}-${k++}`} className="inline">
          {m[5]}
        </code>,
      );
    } else if (m[6] != null && m[7] != null) {
      out.push(
        <a
          key={`${baseKey}-${k++}`}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {m[6]}
        </a>,
      );
    } else if (m[8] != null) {
      const { url, trailing } = cleanBareUrl(m[8]);
      out.push(
        <a
          key={`${baseKey}-${k++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {url}
        </a>,
      );
      if (trailing) out.push(trailing);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderInline(text: string): ReactNode[] {
  // Preserve single newlines as <br/>; double-newline paragraph breaks are
  // already split into separate Block elements upstream.
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    out.push(...renderSegment(line, i));
    if (i < lines.length - 1) out.push(<br key={`br-${i}`} />);
  });
  return out;
}
