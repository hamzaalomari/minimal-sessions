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
  onClose(): void;
}

export function SettingsPopover({
  anchor,
  theme,
  density,
  onThemeChange,
  onDensityChange,
  onClose,
}: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose);

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
      <div className="set-sep" />
      <div className="set-row" style={{ cursor: 'default' }}>
        <div>
          <div className="set-label">More controls in Tweaks</div>
          <div className="set-sub">Open the Tweaks panel for accent & fonts</div>
        </div>
        <Icon name="sliders" style={{ width: 18, height: 18, color: 'var(--faint)' }} />
      </div>
    </div>
  );
}
