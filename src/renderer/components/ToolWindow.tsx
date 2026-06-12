import { useState } from 'react';
import type { ToolKind } from '@shared/types';
import { Icon, type IconName } from './Icon';
import { renderAnsi } from '../lib/ansi';
import { highlightNodes } from '../lib/highlight';
import { DiffView } from './DiffView';

const VERB: Record<ToolKind, string> = {
  read: 'Read',
  edit: 'Edit',
  write: 'Wrote',
  search: 'Searched',
  bash: 'Bash',
};

const VERB_PLURAL: Record<ToolKind, string> = {
  read: 'Read',
  edit: 'Edited',
  write: 'Wrote',
  search: 'Searched',
  bash: 'Bash',
};

const TOOL_ICON: Record<ToolKind, IconName> = {
  read: 'file',
  edit: 'pencil',
  write: 'file',
  search: 'search',
  bash: 'terminal',
};

interface ToolWindowProps {
  kind: ToolKind;
  path: string;
  paths?: string[];
  tag?: string;
  summary?: string;
  code?: string;
  diff?: string;
  defaultOpen?: boolean;
}

export function ToolWindow({
  kind,
  path,
  paths,
  tag,
  summary,
  code,
  diff,
  defaultOpen,
}: ToolWindowProps) {
  const isMulti = (paths?.length ?? 0) > 1;
  const [open, setOpen] = useState(Boolean(defaultOpen) || isMulti);
  const verb = isMulti ? VERB_PLURAL[kind] ?? 'Tool' : VERB[kind] ?? 'Tool';
  const hasBody = Boolean(code || diff || isMulti);

  const tagClass =
    tag && /passed|✓/.test(tag) ? ' ok' : kind === 'edit' ? ' diff' : '';

  return (
    <div className={'toolwin' + (open ? ' open' : '') + (kind === 'bash' ? ' bash' : '')}>
      <button
        type="button"
        className="toolwin-hd"
        onClick={() => hasBody && setOpen((o) => !o)}
        disabled={!hasBody}
        aria-expanded={hasBody ? open : undefined}
      >
        <Icon name={TOOL_ICON[kind] ?? 'file'} className="tw-ico" />
        <span className="tw-verb">{verb}</span>
        {isMulti ? (
          <span className="tw-path">
            {paths!.length} {paths!.length === 1 ? 'item' : 'items'}
          </span>
        ) : (
          <span className="tw-path">{path}</span>
        )}
        {tag && <span className={'tw-tag' + tagClass}>{tag}</span>}
        {hasBody && <Icon name="chevD" className="tw-chev" />}
      </button>
      {summary && <div className="tw-summary">{summary}</div>}
      {open && hasBody && (
        <div className="toolwin-bd">
          {isMulti ? (
            <ul className="tw-paths">
              {paths!.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <>
              {diff && <DiffView text={diff} />}
              {code &&
                (kind === 'bash' ? (
                  <pre className="tw-term">{renderAnsi(code)}</pre>
                ) : (
                  <pre className="tw-code">{highlightNodes(code, 'plaintext')}</pre>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
