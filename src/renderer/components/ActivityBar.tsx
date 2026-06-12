import type { MouseEvent } from 'react';
import { Icon } from './Icon';
import { formatShortcut } from '../lib/platform';
import iconUrl from '../assets/brand/minimal-sessions-icon.svg';

interface ActivityBarProps {
  sideOpen: boolean;
  sidebarView: 'sessions' | 'history' | 'search' | 'analytics' | 'plugins';
  onToggleSide(): void;
  onSelectSessions(): void;
  onSelectHistory(): void;
  onSelectAnalytics(): void;
  onSelectPlugins(): void;
  onOpenSettings?(anchor: HTMLElement): void;
  onOpenSearch?(): void;
}

export function ActivityBar({
  sideOpen,
  sidebarView,
  onToggleSide,
  onSelectSessions,
  onSelectHistory,
  onSelectAnalytics,
  onSelectPlugins,
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
        title={`Sessions (${formatShortcut('B')})`}
        aria-label="Toggle sessions sidebar"
      >
        <Icon name="sessions" />
      </button>
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'search' ? ' on' : '')
        }
        title={`Search (${formatShortcut('F')})`}
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
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'analytics' ? ' on' : '')
        }
        title="Analytics"
        aria-label="Usage analytics"
        onClick={() => {
          if (sideOpen && sidebarView === 'analytics') onToggleSide();
          else {
            if (!sideOpen) onToggleSide();
            onSelectAnalytics();
          }
        }}
      >
        <Icon name="chart" />
      </button>
      <button
        className={
          'act-btn' + (sideOpen && sidebarView === 'plugins' ? ' on' : '')
        }
        title="Plugins"
        aria-label="Plugin marketplace"
        onClick={() => {
          if (sideOpen && sidebarView === 'plugins') onToggleSide();
          else {
            if (!sideOpen) onToggleSide();
            onSelectPlugins();
          }
        }}
      >
        <Icon name="cpu" />
      </button>
      <div className="act-spacer" />
      <button
        className="act-btn"
        title={`Settings (${formatShortcut(',')})`}
        aria-label="Settings"
        onClick={handleSettings}
      >
        <Icon name="gear" />
      </button>
    </div>
  );
}
