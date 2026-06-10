import type { Block as BlockT } from '@shared/types';
import { parseMarkdown } from '@shared/markdown';
import { renderInline } from '../lib/markdown';
import { CodeBlock } from './CodeBlock';
import { Icon, type IconName } from './Icon';
import { ToolWindow } from './ToolWindow';

interface BlockProps {
  block: BlockT;
}

const TOOL_LINE_ICON: Record<string, IconName> = {
  Run: 'terminal',
  Edit: 'pencil',
  Read: 'file',
  Write: 'file',
  Search: 'search',
};

/** Heuristic — if any line starts with header/list/fence syntax (or looks
 *  like a GFM table row), the text is markdown that needs structural
 *  parsing, not just inline formatting. */
const BLOCK_MD_RE = /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|```|\|.+\|)/;

export function Block({ block: b }: BlockProps) {
  switch (b.type) {
    case 'p':
      // Legacy DB rows and the live streaming overlay can carry raw markdown
      // in a single 'p' block. Re-parse and render as multiple blocks when
      // we detect block-level syntax.
      if (BLOCK_MD_RE.test(b.text)) {
        const parsed = parseMarkdown(b.text);
        if (parsed.length > 1 || (parsed[0] && parsed[0].type !== 'p')) {
          return (
            <>
              {parsed.map((sub, i) => (
                <Block key={i} block={sub} />
              ))}
            </>
          );
        }
      }
      return <p>{renderInline(b.text)}</p>;
    case 'h':
      return <h4>{b.text}</h4>;
    case 'ul':
      return (
        <ul>
          {b.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case 'code':
      return <CodeBlock lang={b.lang} code={b.code} />;
    case 'table':
      return (
        <div className="md-table-wrap">
          <table className="md-table">
            {b.headers.length > 0 && (
              <thead>
                <tr>
                  {b.headers.map((h, i) => (
                    <th key={i}>{renderInline(h)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'tool':
      return (
        <div className="tool-line">
          <Icon name={TOOL_LINE_ICON[b.label] ?? 'file'} className="tl-ico" />
          <span className="tl-label">{b.label}</span>
          <span className="tl-path">{b.path}</span>
          {b.tag && <span className="tl-tag">{b.tag}</span>}
        </div>
      );
    case 'win':
      return (
        <ToolWindow
          kind={b.kind}
          path={b.path}
          paths={b.paths}
          tag={b.tag}
          summary={b.summary}
          code={b.code}
          diff={b.diff}
          defaultOpen={b.defaultOpen}
        />
      );
    case 'error':
      return <div className="block-error" role="alert">{b.message}</div>;
  }
}
