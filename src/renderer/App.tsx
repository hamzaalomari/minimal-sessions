import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Platform } from '@shared/api';
import { ActivityBar } from './components/ActivityBar';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TitleBar } from './components/TitleBar';
import { useActiveSession, useSessions } from './state/sessions';
import { useApplyTweaks, useTweaks } from './state/tweaks';

export function App() {
  useApplyTweaks();
  const theme = useTweaks((s) => s.theme);
  const toggleTheme = useTweaks((s) => s.toggleTheme);

  const { sideOpen, toggleSide } = useSessions(
    useShallow((s) => ({ sideOpen: s.sideOpen, toggleSide: s.toggleSide })),
  );
  const active = useActiveSession();

  const [platform, setPlatform] = useState<Platform | ''>('');

  useEffect(() => {
    void window.api.app.platform().then(setPlatform);
  }, []);

  const isMac = platform === 'darwin';
  const title = active ? active.name : 'Claude Session Viewer';

  return (
    <div className={'app' + (sideOpen ? '' : ' side-collapsed')}>
      <TitleBar title={title} isMac={isMac} />
      <ActivityBar sideOpen={sideOpen} onToggleSide={toggleSide} />
      <Sidebar />

      <main className="main">
        <TabBar />
        <div className="main-placeholder">
          <strong>M1.1 — chrome</strong>
          {active
            ? `Active: ${active.name} (${active.turns.length} turns)`
            : 'Pick a session from the sidebar.'}
        </div>
      </main>

      <footer className="statusbar">
        <div className="st-spacer" />
        <button
          className="st-seg st-btn"
          onClick={toggleTheme}
          title="Toggle light / dark"
          aria-label="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </footer>
    </div>
  );
}
