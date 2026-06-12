import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from './Icon';
import { MARKETPLACE_PLUGINS, type MarketplacePlugin } from '../data/plugin-marketplace';
import { useSessions } from '../state/sessions';

/**
 * "Plugins" sidebar view — browse a curated set of community plugins and
 * install with one click. Install runs `claude plugin install <id>` in the
 * embedded terminal (creating a "Plugin Install" session if there's no
 * active one), the same way the "Sign in to Claude" flow does.
 *
 * We don't try to maintain the universe of plugins here — the in-app list
 * is hand-curated and intentionally short. The terminal stays the escape
 * hatch for anything not listed.
 */
export function PluginMarketplaceView() {
  const {
    activeId,
    createSession,
    selectSession,
    terminalOpenIds,
    toggleTerminalOpen,
    setPendingTerminalCommand,
    consumePendingTerminalCommand,
  } = useSessions(
    useShallow((s) => ({
      activeId: s.activeId,
      createSession: s.createSession,
      selectSession: s.selectSession,
      terminalOpenIds: s.terminalOpenIds,
      toggleTerminalOpen: s.toggleTerminalOpen,
      setPendingTerminalCommand: s.setPendingTerminalCommand,
      consumePendingTerminalCommand: s.consumePendingTerminalCommand,
    })),
  );
  const [confirming, setConfirming] = useState<MarketplacePlugin | null>(null);

  const install = async (plugin: MarketplacePlugin): Promise<void> => {
    setConfirming(null);
    let targetId = activeId;
    if (!targetId) {
      const home = await window.api.app.homeDir().catch(() => '~');
      const session = createSession({
        name: 'Plugin Install',
        path: home,
        model: 'claude-sonnet-4-6',
        systemPrompt: '',
        branch: '',
      });
      targetId = session.id;
    }
    const cmd = `claude plugin install ${plugin.installId}\n`;
    setPendingTerminalCommand(targetId, cmd);
    if (!terminalOpenIds.includes(targetId)) {
      toggleTerminalOpen(targetId);
    } else {
      // Terminal already open — the consume hook only fires on PTY open, so
      // pop our own command and write it directly.
      const pending = consumePendingTerminalCommand(targetId);
      if (pending) void window.api.terminal.write(targetId, pending);
    }
    selectSession(targetId);
  };

  return (
    <aside className="sidebar" aria-label="Plugins">
      <div className="sidebar-hd">
        <div className="side-title">
          <span>Plugins</span>
          <span className="side-count">{MARKETPLACE_PLUGINS.length}</span>
        </div>
        <div className="plug-blurb">
          Curated community plugins. Install runs{' '}
          <code>claude plugin install</code> in the terminal — needs the Claude
          CLI on your <code>PATH</code>.
        </div>
      </div>
      <div className="plug-list scroll">
        {MARKETPLACE_PLUGINS.map((p) => (
          <div key={p.installId} className="plug-card" data-testid={`plug-${p.installId}`}>
            <div className="plug-head">
              <div className="plug-name">
                {p.name}
                <span className="plug-author">by {p.author}</span>
              </div>
              {p.url && (
                <button
                  type="button"
                  className="plug-link"
                  title="Open homepage"
                  aria-label={`Open ${p.name} homepage`}
                  onClick={() => p.url && void window.api?.app?.openExternal?.(p.url)}
                >
                  <Icon name="layout" />
                </button>
              )}
            </div>
            <div className="plug-desc">{p.description}</div>
            <div className="plug-tags">
              {p.tags.map((t) => (
                <span key={t} className="plug-tag">
                  {t}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="plug-install-btn"
              onClick={() => setConfirming(p)}
            >
              Install
            </button>
          </div>
        ))}
      </div>

      {confirming && (
        <div className="plug-modal-scrim" onClick={() => setConfirming(null)}>
          <div
            className="plug-modal"
            role="dialog"
            aria-label="Confirm plugin install"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="plug-modal-title">Install {confirming.name}?</strong>
            <p className="plug-modal-body">
              This will open the embedded terminal and run:
            </p>
            <pre className="plug-modal-cmd">
              claude plugin install {confirming.installId}
            </pre>
            <p className="plug-modal-hint">
              The Claude CLI handles the install. Make sure it&rsquo;s on your{' '}
              <code>PATH</code> and authenticated (Settings → Sign in to
              Claude).
            </p>
            <div className="plug-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void install(confirming)}
              >
                Run install
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
