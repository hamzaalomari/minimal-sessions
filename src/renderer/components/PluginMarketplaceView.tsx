import { useMemo, useState } from 'react';
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
 *
 * Polish (PR #25): a text search box, tag chips, and a "Dispatched" badge
 * on cards the user has already kicked off — the install state is tracked
 * in the persisted `dispatchedInstalls` array on the sessions store.
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
    dispatchedInstalls,
    markInstallDispatched,
  } = useSessions(
    useShallow((s) => ({
      activeId: s.activeId,
      createSession: s.createSession,
      selectSession: s.selectSession,
      terminalOpenIds: s.terminalOpenIds,
      toggleTerminalOpen: s.toggleTerminalOpen,
      setPendingTerminalCommand: s.setPendingTerminalCommand,
      consumePendingTerminalCommand: s.consumePendingTerminalCommand,
      dispatchedInstalls: s.dispatchedInstalls,
      markInstallDispatched: s.markInstallDispatched,
    })),
  );
  const [confirming, setConfirming] = useState<MarketplacePlugin | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const p of MARKETPLACE_PLUGINS) for (const t of p.tags) set.add(t);
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKETPLACE_PLUGINS.filter((p) => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (!q) return true;
      const hay =
        `${p.name} ${p.author} ${p.description} ${p.tags.join(' ')} ${p.installId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, activeTag]);

  const dispatched = useMemo(
    () => new Set(dispatchedInstalls),
    [dispatchedInstalls],
  );

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
    markInstallDispatched(plugin.installId);
  };

  return (
    <aside className="sidebar" aria-label="Plugins">
      <div className="sidebar-hd">
        <div className="side-title">
          <span>Plugins</span>
          <span className="side-count">
            {filtered.length === MARKETPLACE_PLUGINS.length
              ? MARKETPLACE_PLUGINS.length
              : `${filtered.length}/${MARKETPLACE_PLUGINS.length}`}
          </span>
        </div>
        <div className="plug-blurb">
          Curated community plugins. Install runs{' '}
          <code>claude plugin install</code> in the terminal — needs the Claude
          CLI on your <code>PATH</code>.
        </div>
        <div className="plug-search">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Search plugins…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search plugins"
          />
          {query && (
            <button
              type="button"
              className="plug-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        {allTags.length > 0 && (
          <div className="plug-tag-row" role="group" aria-label="Filter by tag">
            <button
              type="button"
              className={'plug-tag-chip' + (activeTag === null ? ' on' : '')}
              onClick={() => setActiveTag(null)}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={'plug-tag-chip' + (activeTag === t ? ' on' : '')}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="plug-list scroll">
        {filtered.length === 0 ? (
          <div className="plug-empty">
            <strong>No plugins match</strong>
            <span>Try clearing the search or filter.</span>
          </div>
        ) : (
          filtered.map((p) => {
            const wasDispatched = dispatched.has(p.installId);
            return (
              <div
                key={p.installId}
                className={'plug-card' + (wasDispatched ? ' plug-card-tried' : '')}
                data-testid={`plug-${p.installId}`}
              >
                <div className="plug-head">
                  <div className="plug-name">
                    {p.name}
                    <span className="plug-author">by {p.author}</span>
                  </div>
                  <div className="plug-head-right">
                    {wasDispatched && (
                      <span
                        className="plug-status-badge"
                        title="You've dispatched this install at least once. Check the terminal for status."
                      >
                        Dispatched
                      </span>
                    )}
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
                  {wasDispatched ? 'Re-install' : 'Install'}
                </button>
              </div>
            );
          })
        )}
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
