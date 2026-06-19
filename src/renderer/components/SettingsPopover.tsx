import { useEffect, useRef, useState } from 'react';
import type { UpdaterState } from '@shared/api';
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
  /** Open the embedded terminal, start the `claude` REPL, and send `/login`
   *  inside it so the user can authenticate without leaving the app. */
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

  // Lightweight Updates section. We always show the version (works in dev
  // too via package.json), but only show the Check-for-updates action when
  // the updater is actually enabled — otherwise it would do nothing.
  const [version, setVersion] = useState<string>('');
  const [updater, setUpdater] = useState<UpdaterState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void window.api?.app?.version?.().then((v) => {
      if (!cancelled) setVersion(v);
    });
    void window.api?.updater?.getState?.().then((s) => {
      if (!cancelled) setUpdater(s);
    });
    const off = window.api?.updater?.onState?.((s) => setUpdater(s));
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  const updateLabel = (() => {
    if (!updater?.enabled) return 'Auto-update disabled (dev build)';
    switch (updater.status) {
      case 'checking':
        return 'Checking for updates…';
      case 'downloading':
        return typeof updater.progress === 'number'
          ? `Downloading update… ${Math.round(updater.progress * 100)}%`
          : 'Downloading update…';
      case 'available':
        return updater.version
          ? `Update v${updater.version} found`
          : 'Update found';
      case 'ready':
        return updater.version
          ? `v${updater.version} ready — restart to install`
          : 'Restart to install update';
      case 'not-available':
        return 'You are on the latest version';
      case 'error':
        return updater.error
          ? `Last check failed: ${updater.error}`
          : 'Last update check failed';
      default:
        return 'Click to check for updates';
    }
  })();

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
                Opens a terminal, starts <code>claude</code>, and sends{' '}
                <code>/login</code> — needed once if the SDK can&rsquo;t find
                existing credentials.
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
        onClick={() => {
          if (updater?.enabled) void window.api.updater.check();
        }}
        disabled={!updater?.enabled || updater?.status === 'checking'}
        data-testid="check-for-updates"
      >
        <div>
          <div className="set-label">
            {updater?.enabled ? 'Check for updates' : 'Updates'}
          </div>
          <div className="set-sub">{updateLabel}</div>
        </div>
        <Icon name="spark" style={{ width: 18, height: 18, color: 'var(--faint)' }} />
      </button>
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
      <div className="set-sep" />
      <button
        type="button"
        className="set-row set-action"
        onClick={() => {
          void window.api?.app?.revealLog?.();
        }}
        data-testid="reveal-log"
      >
        <div>
          <div className="set-label">Reveal diagnostic log</div>
          <div className="set-sub">
            Opens Finder at <code>main.log</code> — useful when sending a
            message produces no reply.
          </div>
        </div>
        <Icon name="terminal" style={{ width: 18, height: 18, color: 'var(--faint)' }} />
      </button>
      {version && (
        <div className="set-version" aria-label={`Version ${version}`}>
          Minimal Sessions v{version}
        </div>
      )}
    </div>
  );
}
