import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { renderCombo, SHORTCUT_GROUPS } from '../data/shortcuts';
import { isMac } from '../lib/platform';

interface Props {
  onClose(): void;
}

/**
 * Cheatsheet modal listing every bound shortcut, grouped by category.
 * Toggled via ⌘/ (Ctrl+/ on Windows / Linux) or by the View menu.
 *
 * Escape closes; clicking the scrim closes; clicking the panel itself
 * does not. The panel is portaled so it floats above the grid without
 * needing a layout slot.
 */
export function ShortcutsOverlay({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mac = isMac();

  return createPortal(
    <div
      className="kbd-scrim"
      role="presentation"
      onClick={onClose}
      data-testid="shortcuts-overlay"
    >
      <div
        className="kbd-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kbd-hd">
          <strong>Keyboard shortcuts</strong>
          <button
            type="button"
            className="kbd-close"
            aria-label="Close shortcuts"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="kbd-cols">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="kbd-group">
              <div className="kbd-group-title">{group.title}</div>
              <dl className="kbd-list">
                {group.entries.map((entry) => (
                  <div key={`${group.title}-${entry.label}-${entry.combo}`} className="kbd-row">
                    <dt>{entry.label}</dt>
                    <dd>
                      <kbd>{renderCombo(entry.combo, mac)}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="kbd-foot">
          Press <kbd>Esc</kbd> to close.
        </div>
      </div>
    </div>,
    document.body,
  );
}
