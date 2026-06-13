import { useEffect, useState, type ReactElement } from 'react';
import type { UpdaterState } from '@shared/api';
import { Icon } from './Icon';

/**
 * Thin banner anchored above the status bar that surfaces auto-update
 * lifecycle. Hidden entirely when the updater is disabled (dev builds,
 * `MS_DISABLE_AUTO_UPDATE=1`) or when there's nothing newsworthy to show.
 *
 * The banner is intentionally low-noise: nothing to render in `idle`,
 * `not-available`, or `checking` so a successful background poll never
 * pops up. We only surface UI when the user has a concrete action
 * (update available, install ready) or when something went wrong.
 */
export function UpdateBanner(): ReactElement | null {
  const [state, setState] = useState<UpdaterState>({
    status: 'idle',
    enabled: false,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.api?.updater) return;
    void window.api.updater.getState().then(setState);
    const off = window.api.updater.onState((next) => {
      // Clear dismissal whenever the lifecycle moves to a new status —
      // that way "available" → user dismisses → "ready" still surfaces
      // the restart CTA, but a repeat "available" event stays hidden.
      setState((prev) => {
        if (prev.status !== next.status) setDismissed(false);
        return next;
      });
    });
    return off;
  }, []);

  if (!state.enabled) return null;
  if (dismissed) return null;
  if (state.status === 'idle' || state.status === 'not-available' || state.status === 'checking') {
    return null;
  }

  const { status, version, progress, error } = state;
  const versionLabel = version ? `v${version}` : '';

  return (
    <div className={`update-banner update-${status}`} role="status" aria-live="polite">
      <Icon name={status === 'error' ? 'alert' : 'spark'} />
      <div className="update-msg">
        {status === 'available' && (
          <>Update {versionLabel} available — downloading…</>
        )}
        {status === 'downloading' && (
          <>
            Downloading update {versionLabel}
            {typeof progress === 'number' && (
              <> · {Math.round(progress * 100)}%</>
            )}
          </>
        )}
        {status === 'ready' && (
          <>Update {versionLabel} ready — restart to install.</>
        )}
        {status === 'error' && <>Update failed: {error || 'unknown error'}</>}
      </div>
      <div className="update-actions">
        {status === 'ready' && (
          <button
            type="button"
            className="update-cta"
            onClick={() => void window.api.updater.install()}
          >
            Restart
          </button>
        )}
        {status === 'error' && (
          <button
            type="button"
            className="update-cta"
            onClick={() => void window.api.updater.check()}
          >
            Retry
          </button>
        )}
        <button
          type="button"
          className="update-close"
          aria-label="Dismiss update notice"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
