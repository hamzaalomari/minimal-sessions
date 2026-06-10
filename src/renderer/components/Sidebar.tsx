import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { SessionItem } from './SessionItem';
import { useSessions } from '../state/sessions';

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
    selectSession,
    setShowNew,
    setSidebarView,
    commitRename,
    restoreSession,
  } = useSessions(
    useShallow((s) => ({
      sessions: s.sessions,
      deletedSessions: s.deletedSessions,
      sidebarView: s.sidebarView,
      activeId: s.activeId,
      renamingId: s.renamingId,
      selectSession: s.selectSession,
      setShowNew: s.setShowNew,
      setSidebarView: s.setSidebarView,
      commitRename: s.commitRename,
      restoreSession: s.restoreSession,
    })),
  );

  if (sidebarView === 'history') {
    return (
      <aside className="sidebar" aria-label="History">
        <div className="sidebar-hd">
          <div className="side-title">
            <span>History</span>
            <span className="side-count">{deletedSessions.length}</span>
          </div>
          <button
            className="new-btn"
            onClick={() => setSidebarView('sessions')}
            title="Back to sessions"
          >
            <Icon name="chevR" />
            Sessions
          </button>
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
                <button
                  className="si-restore"
                  title="Restore session"
                  aria-label="Restore session"
                  onClick={() => restoreSession(s.id)}
                >
                  Restore
                </button>
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
            onSelect={() => selectSession(s.id)}
            onRenameCommit={(name) => commitRename(s.id, name)}
            onOpenMenu={onOpenMenu}
          />
        ))}
      </div>
    </aside>
  );
}
