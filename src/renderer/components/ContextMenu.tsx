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
  onEditInstructions(): void;
  onCloseTab(): void;
  onDelete(): void;
  onClose(): void;
  /** The button that opened the menu. Mousedown on it is ignored so a second
   *  click on the same button closes the menu instead of immediately reopening it. */
  triggerEl?: HTMLElement | null;
}

type ItemIcon = 'pencil' | 'close' | 'trash' | 'sliders';

export function ContextMenu({
  anchor,
  canCloseTab,
  onRename,
  onEditInstructions,
  onCloseTab,
  onDelete,
  onClose,
  triggerEl,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose, { triggerEl });

  const item = (label: string, icon: ItemIcon, onClick: () => void, danger = false) => (
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
      {item('Edit instructions', 'sliders', onEditInstructions)}
      {canCloseTab && item('Close tab', 'close', onCloseTab)}
      <div className="ctx-sep" />
      {item('Delete session', 'trash', onDelete, true)}
    </div>
  );
}
