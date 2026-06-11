import type { MouseEvent } from 'react';
import { Icon } from './Icon';
import iconUrl from '../assets/brand/minimal-sessions-icon.svg';

interface ActivityBarProps {
  sideOpen: boolean;
  sidebarView: 'sessions' | 'history' | 'search';
  onToggleSide(): void;
  onSelectSessions(): void;
  onSelectHistory(): void;
  onOpenSettings?(anchor: HTMLElement): void;
  onOpenSearch?(): void;
}

export function ActivityBar({
  sideOpen,
  sidebarView,
  onToggleSide,
  onSelectSessions,
  onSelectHistory,
  onOpenSettings,
  onOpenSearch,
}: ActivityBarProps) {
  const handleSettings = (e: MouseEvent<HTMLButtonElement>) => {
    onOpenSettings?.(e.currentTarget);
  };

  return (
    <div className="activitybar">
      <div className="act-mark" title="Minimal Sessions">
        <img src={iconUrl} alt="" aria-hidden="true" />
      </div>
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'sessions' ? ' on' : '')
        }
        onClick={() => {
          if (sideOpen && sidebarView === 'sessions') onToggleSide();
          else {
            if (!sideOpen) onToggleSide();
            onSelectSessions();
          }
        }}
        title="Sessions"
        aria-label="Toggle sessions sidebar"
      >
        <Icon name="sessions" />
      </button>
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'search' ? ' on' : '')
        }
        title="Search"
        aria-label="Search"
        onClick={() => {
          if (sideOpen && sidebarView === 'search') onToggleSide();
          else onOpenSearch?.();
        }}
      >
        <Icon name="search" />
      </button>
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'history' ? ' on' : '')
        }
        title="History"
        aria-label="Deleted sessions history"
        onClick={() => {
          if (sideOpen && sidebarView === 'history') onToggleSide();
          else {
            if (!sideOpen) onToggleSide();
            onSelectHistory();
          }
        }}
      >
        <Icon name="clock" />
      </button>
      <div className="act-spacer" />
      <button
        className="act-btn"
        title="Settings"
        aria-label="Settings"
        onClick={handleSettings}
      >
        <Icon name="gear" />
      </button>
    </div>
  );
}
