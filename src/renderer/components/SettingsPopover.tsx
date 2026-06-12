import { useRef } from 'react';
import type { Density, Theme } from '../state/tweaks';
import { Icon } from './Icon';
import { usePopoverClose } from '../lib/usePopoverClose';
import { anchorStyle, type Anchor } from './ContextMenu';

interface SettingsPopoverProps {
  anchor: Anchor;
  theme: Theme;
  density: Density;
  onThemeChange(theme: Theme): void;
  onDensityChange(density: Density): void;
  onOpenTweaks?(): void;
  /** Open the embedded terminal pre-running `claude login` so the user can
   *  authenticate the bundled Claude binary without leaving the app. */
  onSignInToClaude?(): void;
  onClose(): void;
  /** The button that opened the popover. Mousedown on it is ignored by the
   *  close handler so a second click on it can toggle the popover closed. */
  triggerEl?: HTMLElement | null;
}

export function SettingsPopover({
  anchor,
  theme,
  density,
  onThemeChange,
  onDensityChange,
  onOpenTweaks,
  onSignInToClaude,
  onClose,
  triggerEl,
}: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose, { triggerEl });

  return (
    <div
      ref={ref}
      className="settings-pop"
      role="dialog"
      aria-label="Appearance settings"
      style={anchorStyle(anchor)}
      data-testid="settings-popover"
    >
      <div className="set-hd">Appearance</div>
      <div className="set-row">
        <div>
          <div className="set-label">Theme</div>
          <div className="set-sub">Light or dark interface</div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Theme">
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'light'}
            className={theme === 'light' ? 'on' : ''}
            onClick={() => onThemeChange('light')}
          >
            Light
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'dark'}
            className={theme === 'dark' ? 'on' : ''}
            onClick={() => onThemeChange('dark')}
          >
            Dark
          </button>
        </div>
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">Density</div>
          <div className="set-sub">Spacing of the transcript</div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Density">
          <button
            type="button"
            role="radio"
            aria-checked={density === 'compact'}
            className={density === 'compact' ? 'on' : ''}
            onClick={() => onDensityChange('compact')}
          >
            Compact
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={density === 'cozy'}
            className={density === 'cozy' ? 'on' : ''}
            onClick={() => onDensityChange('cozy')}
          >
            Cozy
          </button>
        </div>
      </div>
      {onSignInToClaude && (
        <>
          <div className="set-sep" />
          <button
            type="button"
            className="set-row set-action"
            onClick={onSignInToClaude}
            data-testid="sign-in-to-claude"
          >
            <div>
              <div className="set-label">Sign in to Claude</div>
              <div className="set-sub">
                Runs <code>claude login</code> in a terminal — needed once if
                the SDK can&rsquo;t find existing credentials.
              </div>
            </div>
            <Icon name="terminal" style={{ width: 18, height: 18, color: 'var(--faint)' }} />
          </button>
        </>
      )}
      <div className="set-sep" />
      <button
        type="button"
        className="set-row set-action"
        onClick={onOpenTweaks}
        data-testid="open-tweaks"
      >
        <div>
          <div className="set-label">More controls in Tweaks</div>
          <div className="set-sub">Font, system prompt, and more</div>
        </div>
        <Icon name="sliders" style={{ width: 18, height: 18, color: 'var(--faint)' }} />
      </button>
    </div>
  );
}
