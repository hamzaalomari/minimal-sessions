import type { KeyboardEvent, MouseEvent } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { getModel } from '../data/models';
import { fmtRelativeTime } from '../lib/format';

interface SessionItemProps {
  session: Session;
  active: boolean;
  renaming: boolean;
  onSelect(): void;
  onRenameCommit(name: string | null): void;
  onOpenMenu?(id: string, anchor: HTMLElement): void;
}

export function SessionItem({
  session: s,
  active,
  renaming,
  onSelect,
  onRenameCommit,
  onOpenMenu,
}: SessionItemProps) {
  const m = getModel(s.model);
  const dot = m?.color ?? 'var(--faint)';
  const short = m?.short ?? s.model;

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpenMenu?.(s.id, e.currentTarget);
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onRenameCommit(e.currentTarget.value);
    else if (e.key === 'Escape') onRenameCommit(null);
  };

  return (
    <div
      role="listitem"
      className={'session-item' + (active ? ' active' : '')}
      onClick={onSelect}
      data-testid={`session-item-${s.id}`}
    >
      <div className="si-row">
        <span className="si-dot" style={{ background: dot }} />
        {renaming ? (
          <input
            className="rename-input"
            autoFocus
            defaultValue={s.name}
            aria-label="Rename session"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleRenameKey}
            onBlur={(e) => onRenameCommit(e.currentTarget.value)}
          />
        ) : (
          <span className="si-name">{s.name}</span>
        )}
        {!renaming && (
          <span className="si-time">{fmtRelativeTime(s.lastActiveAt)}</span>
        )}
      </div>
      <div className="si-path">{s.path}</div>
      <div className="si-meta">
        <span className="si-model" style={{ color: dot }}>
          {short}
        </span>
        <span className="si-msgs">
          · {s.turns.length} {s.turns.length === 1 ? 'message' : 'messages'}
        </span>
      </div>
      <button
        className="si-menu"
        title="Session options"
        aria-label="Session options"
        onClick={handleMenu}
      >
        <Icon name="dots" />
      </button>
    </div>
  );
}
