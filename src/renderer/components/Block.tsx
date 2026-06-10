import type { Block as BlockT } from '@shared/types';
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

export function Block({ block: b }: BlockProps) {
  switch (b.type) {
    case 'p':
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
