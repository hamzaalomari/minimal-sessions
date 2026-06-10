import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { childPath, FOLDER_TREE, hasChildren } from '../data/folderTree';
import { usePopoverClose } from '../lib/usePopoverClose';

interface FolderPickerProps {
  onPick(path: string): void;
  onClose(): void;
}

export function FolderPicker({ onPick, onClose }: FolderPickerProps) {
  const [cwd, setCwd] = useState('~');
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose);

  const items = FOLDER_TREE[cwd] ?? [];
  const crumbs = cwd.split('/');

  const enter = (name: string) => {
    const next = childPath(cwd, name);
    if (hasChildren(next)) setCwd(next);
    else onPick(next);
  };

  const up = () => {
    if (crumbs.length > 1) setCwd(crumbs.slice(0, -1).join('/'));
  };

  return (
    <div className="finder-scrim">
      <div
        ref={ref}
        className="finder"
        role="dialog"
        aria-label="Choose folder"
        data-testid="folder-picker"
      >
        <div className="finder-hd">
          <Icon name="drive" />
          <span>Choose folder</span>
          <span className="finder-crumbs">{cwd}</span>
        </div>
        <div className="finder-list scroll">
          {cwd !== '~' && (
            <button type="button" className="finder-item" onClick={up}>
              <Icon name="chevR" style={{ transform: 'rotate(180deg)' }} />
              <span style={{ color: 'var(--dim)' }}>Back</span>
            </button>
          )}
          {items.map((it) => {
            const next = childPath(cwd, it.name);
            return (
              <button
                key={it.name}
                type="button"
                className="finder-item"
                onClick={() => enter(it.name)}
              >
                <Icon name="folder" />
                <span>{it.name}</span>
                {it.meta && <span className="fi-meta">{it.meta}</span>}
                {hasChildren(next) && (
                  <Icon name="chevR" style={{ width: 14, height: 14, color: 'var(--faint)' }} />
                )}
              </button>
            );
          })}
        </div>
        <div className="finder-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onPick(cwd)}>
            Open “{crumbs[crumbs.length - 1]}”
          </button>
        </div>
      </div>
    </div>
  );
}
