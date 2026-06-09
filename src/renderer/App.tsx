import { useEffect, useState } from 'react';
import type { Platform } from '@shared/api';
import { Icon } from './components/Icon';
import { useApplyTweaks, useTweaks } from './state/tweaks';

export function App() {
  useApplyTweaks();
  const theme = useTweaks((s) => s.theme);
  const toggleTheme = useTweaks((s) => s.toggleTheme);
  const [sideOpen, setSideOpen] = useState(true);
  const [pong, setPong] = useState<string>('');
  const [platform, setPlatform] = useState<Platform | ''>('');

  useEffect(() => {
    void window.api.app.ping().then(setPong);
    void window.api.app.platform().then(setPlatform);
  }, []);

  const isMac = platform === 'darwin';

  return (
    <div className={'app' + (sideOpen ? '' : ' side-collapsed')}>
      <div className="titlebar">
        {isMac && (
          <div className="traffic">
            <span className="tdot r" />
            <span className="tdot y" />
            <span className="tdot g" />
          </div>
        )}
        <div className="title-name">
          <Icon name="spark" className="title-spark" />
          Claude Session Viewer
        </div>
      </div>

      <div className="activitybar">
        <div className="act-mark" title="Claude Session Viewer">
          <Icon name="spark" />
        </div>
        <button
          className={'act-btn' + (sideOpen ? ' on' : '')}
          onClick={() => setSideOpen((v) => !v)}
          title="Sessions"
          aria-label="Toggle sessions sidebar"
        >
          <Icon name="sessions" />
        </button>
        <button className="act-btn" title="Search" aria-label="Search">
          <Icon name="search" />
        </button>
        <div className="act-spacer" />
        <button className="act-btn" title="Settings" aria-label="Settings">
          <Icon name="gear" />
        </button>
      </div>

      <aside className="sidebar">
        <div className="sidebar-placeholder">Sidebar — sessions list lands in M1.</div>
      </aside>

      <main className="main">
        <div className="main-placeholder">
          <strong>M0 — scaffolding</strong>
          IPC <code>ping</code> → <code>{pong || '…'}</code>
          <br />
          Platform: <code>{platform || '…'}</code>
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
