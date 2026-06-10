import { useState } from 'react';
import type { ToolKind } from '@shared/types';
import { Icon, type IconName } from './Icon';
import { highlightNodes } from '../lib/highlight';
import { DiffView } from './DiffView';

const VERB: Record<ToolKind, string> = {
  read: 'Read',
  edit: 'Edit',
  write: 'Wrote',
  search: 'Searched',
};

const TOOL_ICON: Record<ToolKind, IconName> = {
  read: 'file',
  edit: 'pencil',
  write: 'file',
  search: 'search',
};

interface ToolWindowProps {
  kind: ToolKind;
  path: string;
  tag?: string;
  summary?: string;
  code?: string;
  diff?: string;
  defaultOpen?: boolean;
}

export function ToolWindow({ kind, path, tag, summary, code, diff, defaultOpen }: ToolWindowProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const verb = VERB[kind] ?? 'Tool';
  const hasBody = Boolean(code || diff);

  const tagClass =
    tag && /passed|✓/.test(tag) ? ' ok' : kind === 'edit' ? ' diff' : '';

  return (
    <div className={'toolwin' + (open ? ' open' : '')}>
      <button
        type="button"
        className="toolwin-hd"
        onClick={() => hasBody && setOpen((o) => !o)}
        disabled={!hasBody}
        aria-expanded={hasBody ? open : undefined}
      >
        <Icon name={TOOL_ICON[kind] ?? 'file'} className="tw-ico" />
        <span className="tw-verb">{verb}</span>
        <span className="tw-path">{path}</span>
        {tag && <span className={'tw-tag' + tagClass}>{tag}</span>}
        {hasBody && <Icon name="chevD" className="tw-chev" />}
      </button>
      {summary && <div className="tw-summary">{summary}</div>}
      {open && hasBody && (
        <div className="toolwin-bd">
          {diff && <DiffView text={diff} />}
          {code && <pre className="tw-code">{highlightNodes(code)}</pre>}
        </div>
      )}
    </div>
  );
}
