import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { SessionItem } from './SessionItem';
import { useSessions } from '../state/sessions';

interface SidebarProps {
  onOpenMenu?(id: string, anchor: HTMLElement): void;
}

export function Sidebar({ onOpenMenu }: SidebarProps) {
  const { sessions, activeId, renamingId, selectSession, setShowNew, commitRename } =
    useSessions(
      useShallow((s) => ({
        sessions: s.sessions,
        activeId: s.activeId,
        renamingId: s.renamingId,
        selectSession: s.selectSession,
        setShowNew: s.setShowNew,
        commitRename: s.commitRename,
      })),
    );

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
