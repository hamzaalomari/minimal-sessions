import { Icon } from './Icon';

interface ActivityBarProps {
  sideOpen: boolean;
  onToggleSide(): void;
  onOpenSettings?(): void;
  onOpenSearch?(): void;
}

export function ActivityBar({
  sideOpen,
  onToggleSide,
  onOpenSettings,
  onOpenSearch,
}: ActivityBarProps) {
  return (
    <div className="activitybar">
      <div className="act-mark" title="Claude Session Viewer">
        <Icon name="spark" />
      </div>
      <button
        className={'act-btn' + (sideOpen ? ' on' : '')}
        onClick={onToggleSide}
        title="Sessions"
        aria-label="Toggle sessions sidebar"
      >
        <Icon name="sessions" />
      </button>
      <button
        className="act-btn"
        title="Search"
        aria-label="Search"
        onClick={onOpenSearch}
      >
        <Icon name="search" />
      </button>
      <div className="act-spacer" />
      <button
        className="act-btn"
        title="Settings"
        aria-label="Settings"
        onClick={onOpenSettings}
      >
        <Icon name="gear" />
      </button>
    </div>
  );
}
