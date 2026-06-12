import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@shared/types';
import { AnalyticsView } from './AnalyticsView';
import { Icon } from './Icon';
import { SessionItem } from './SessionItem';
import { useSessions } from '../state/sessions';

function matchesQuery(s: Session, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return s.name.toLowerCase().includes(needle) || s.path.toLowerCase().includes(needle);
}

interface SidebarProps {
  onOpenMenu?(id: string, anchor: HTMLElement): void;
}

export function Sidebar({ onOpenMenu }: SidebarProps) {
  const {
    sessions,
    deletedSessions,
    sidebarView,
    activeId,
    renamingId,
    searchQuery,
    streamingIds,
    selectSession,
    setShowNew,
    setSidebarView,
    setSearchQuery,
    commitRename,
    restoreSession,
    purgeSession,
    purgeAllDeleted,
  } = useSessions(
    useShallow((s) => ({
      sessions: s.sessions,
      deletedSessions: s.deletedSessions,
      sidebarView: s.sidebarView,
      activeId: s.activeId,
      renamingId: s.renamingId,
      searchQuery: s.searchQuery,
      streamingIds: s.streamingIds,
      selectSession: s.selectSession,
      setShowNew: s.setShowNew,
      setSidebarView: s.setSidebarView,
      setSearchQuery: s.setSearchQuery,
      commitRename: s.commitRename,
      restoreSession: s.restoreSession,
      purgeSession: s.purgeSession,
      purgeAllDeleted: s.purgeAllDeleted,
    })),
  );

  const statusOf = (s: Session): 'empty' | 'busy' | 'idle' => {
    if (streamingIds.includes(s.id)) return 'busy';
    if (s.turns.length === 0) return 'empty';
    return 'idle';
  };

  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (sidebarView === 'search') searchRef.current?.focus();
  }, [sidebarView]);

  if (sidebarView === 'search') {
    const hasQuery = searchQuery.trim().length > 0;
    const openMatches = hasQuery
      ? sessions.filter((s) => matchesQuery(s, searchQuery))
      : [];
    const histMatches = hasQuery
      ? deletedSessions.filter((s) => matchesQuery(s, searchQuery))
      : [];
    const noResults = hasQuery && openMatches.length === 0 && histMatches.length === 0;
    return (
      <aside className="sidebar" aria-label="Search sessions">
        <div className="sidebar-hd">
          <div className="side-title">
            <span>Search</span>
          </div>
          <button
            className="new-btn"
            onClick={() => {
              setSearchQuery('');
              setSidebarView('sessions');
            }}
            title="Back to sessions"
          >
            <Icon name="chevR" />
            Sessions
          </button>
        </div>
        <div className="search-wrap">
          <Icon name="search" />
          <input
            ref={searchRef}
            className="search-input"
            type="text"
            placeholder="Search sessions and history…"
            aria-label="Search sessions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (searchQuery) setSearchQuery('');
                else setSidebarView('sessions');
              }
            }}
          />
        </div>
        <div className="session-list scroll" role="list" data-testid="search-results">
          {!hasQuery && (
            <div className="search-hint" data-testid="search-hint">
              Type to search by name or path. Results appear here.
            </div>
          )}
          {noResults && (
            <div className="side-empty">No sessions match &ldquo;{searchQuery}&rdquo;.</div>
          )}
          {hasQuery && openMatches.length > 0 && (
            <>
              <div className="search-section-hd">
                <span>Open</span>
                <span className="side-count">{openMatches.length}</span>
              </div>
              {openMatches.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === activeId}
                  renaming={s.id === renamingId}
                  status={statusOf(s)}
                  onSelect={() => selectSession(s.id)}
                  onRenameCommit={(name) => commitRename(s.id, name)}
                  onOpenMenu={onOpenMenu}
                />
              ))}
            </>
          )}
          {hasQuery && histMatches.length > 0 && (
            <>
              <div className="search-section-hd">
                <span>History</span>
                <span className="side-count">{histMatches.length}</span>
              </div>
              {histMatches.map((s) => (
                <div
                  key={s.id}
                  role="listitem"
                  className="session-item history"
                  data-testid={`history-item-${s.id}`}
                >
                  <div className="si-row">
                    <span className="si-name">{s.name}</span>
                  </div>
                  <div className="si-path">{s.path}</div>
                  <div className="si-meta">
                    <span className="si-msgs">
                      {s.turns.length} {s.turns.length === 1 ? 'message' : 'messages'}
                    </span>
                  </div>
                  <div className="si-history-actions">
                    <button
                      className="si-restore"
                      title="Restore session"
                      aria-label="Restore session"
                      onClick={() => restoreSession(s.id)}
                    >
                      Restore
                    </button>
                    <button
                      className="si-purge"
                      title="Delete session forever"
                      aria-label="Delete session forever"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete "${s.name}"? This cannot be undone.`,
                          )
                        ) {
                          purgeSession(s.id);
                        }
                      }}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    );
  }

  if (sidebarView === 'analytics') {
    return <AnalyticsView />;
  }

  if (sidebarView === 'history') {
    const onDeleteAll = (): void => {
      const n = deletedSessions.length;
      if (n === 0) return;
      if (
        window.confirm(
          `Permanently delete all ${n} ${
            n === 1 ? 'session' : 'sessions'
          } in History? This cannot be undone.`,
        )
      ) {
        purgeAllDeleted();
      }
    };
    return (
      <aside className="sidebar" aria-label="History">
        <div className="sidebar-hd">
          <div className="side-title">
            <span>History</span>
            <span className="side-count">{deletedSessions.length}</span>
          </div>
          <div className="side-hd-actions">
            {deletedSessions.length > 0 && (
              <button
                className="hist-clear-btn"
                onClick={onDeleteAll}
                title="Permanently delete every session in History"
                aria-label="Delete all history"
                data-testid="history-delete-all"
              >
                <Icon name="trash" />
                Delete all
              </button>
            )}
            <button
              className="new-btn"
              onClick={() => setSidebarView('sessions')}
              title="Back to sessions"
            >
              <Icon name="chevR" />
              Sessions
            </button>
          </div>
        </div>
        <div className="session-list scroll" role="list">
          {deletedSessions.length === 0 ? (
            <div className="side-empty">No deleted sessions.</div>
          ) : (
            deletedSessions.map((s: Session) => (
              <div
                key={s.id}
                role="listitem"
                className="session-item history"
                data-testid={`history-item-${s.id}`}
              >
                <div className="si-row">
                  <span className="si-name">{s.name}</span>
                </div>
                <div className="si-path">{s.path}</div>
                <div className="si-meta">
                  <span className="si-msgs">
                    {s.turns.length} {s.turns.length === 1 ? 'message' : 'messages'}
                  </span>
                </div>
                <div className="si-history-actions">
                  <button
                    className="si-restore"
                    title="Restore session"
                    aria-label="Restore session"
                    onClick={() => restoreSession(s.id)}
                  >
                    Restore
                  </button>
                  <button
                    className="si-purge"
                    title="Delete session forever"
                    aria-label="Delete session forever"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete "${s.name}"? This cannot be undone.`,
                        )
                      ) {
                        purgeSession(s.id);
                      }
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar" aria-label="Sessions">
      <div className="sidebar-hd">
        <div className="side-title">
          <span>Sessions</span>
          <span className="side-count">{sessions.length}</span>
        </div>
        <button className="new-btn" onClick={() => setShowNew(true)}>
          <Icon name="plus" />
          New session
        </button>
      </div>
      <div className="session-list scroll" role="list">
        {sessions.map((s: Session) => (
          <SessionItem
            key={s.id}
            session={s}
            active={s.id === activeId}
            renaming={s.id === renamingId}
            status={statusOf(s)}
            onSelect={() => selectSession(s.id)}
            onRenameCommit={(name) => commitRename(s.id, name)}
            onOpenMenu={onOpenMenu}
          />
        ))}
      </div>
    </aside>
  );
}
