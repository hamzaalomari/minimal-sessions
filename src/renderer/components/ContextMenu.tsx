import { useRef } from 'react';
import { Icon } from './Icon';
import { usePopoverClose } from '../lib/usePopoverClose';

export interface Anchor {
  left: number;
  /** Distance from the top of the viewport. Use this OR bottom, not both. */
  top?: number;
  /** Distance from the bottom of the viewport. Use this OR top, not both. */
  bottom?: number;
}

export function anchorStyle(a: Anchor): {
  left: number;
  top?: number;
  bottom?: number;
} {
  return {
    left: a.left,
    ...(a.top != null ? { top: a.top } : {}),
    ...(a.bottom != null ? { bottom: a.bottom } : {}),
  };
}

interface ContextMenuProps {
  anchor: Anchor;
  canCloseTab: boolean;
  onRename(): void;
  onCloseTab(): void;
  onDelete(): void;
  onClose(): void;
}

export function ContextMenu({
  anchor,
  canCloseTab,
  onRename,
  onCloseTab,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose);

  const item = (label: string, icon: 'pencil' | 'close' | 'trash', onClick: () => void, danger = false) => (
    <button
      type="button"
      className={'ctx-item' + (danger ? ' danger' : '')}
      onClick={() => {
        onClick();
        onClose();
      }}
    >
      <Icon name={icon} />
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="ctx"
      role="menu"
      style={anchorStyle(anchor)}
      data-testid="context-menu"
    >
      {item('Rename', 'pencil', onRename)}
      {canCloseTab && item('Close tab', 'close', onCloseTab)}
      <div className="ctx-sep" />
      {item('Delete session', 'trash', onDelete, true)}
    </div>
  );
}
