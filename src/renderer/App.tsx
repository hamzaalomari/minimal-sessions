import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Platform } from '@shared/api';
import { ActivityBar } from './components/ActivityBar';
import { ContextMenu, type Anchor } from './components/ContextMenu';
import { Icon } from './components/Icon';
import { NewSessionPanel, type NewSessionDraft } from './components/NewSessionPanel';
import { SessionPane } from './components/SessionPane';
import { SettingsPopover } from './components/SettingsPopover';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TitleBar } from './components/TitleBar';
import { useActiveSession, useSessions } from './state/sessions';
import { useApplyTweaks, useTweaks } from './state/tweaks';

const SETTINGS_WIDTH = 288;
const MENU_WIDTH = 172;

function rectAnchor(el: HTMLElement, popoverWidth: number, gap = 6): Anchor {
  const r = el.getBoundingClientRect();
  // Position the popover so its right edge sits near the anchor's right edge,
  // with a small gap below.
  const left = Math.max(8, r.right - popoverWidth);
  return { left, top: r.bottom + gap };
}

function menuAnchor(el: HTMLElement): Anchor {
  const r = el.getBoundingClientRect();
  return { left: Math.max(8, r.right - MENU_WIDTH), top: r.bottom + 4 };
}

export function App() {
  useApplyTweaks();
  const theme = useTweaks((s) => s.theme);
  const density = useTweaks((s) => s.density);
  const toggleTheme = useTweaks((s) => s.toggleTheme);
  const setTheme = useTweaks((s) => s.setTheme);
  const setDensity = useTweaks((s) => s.setDensity);

  const {
    sideOpen,
    showNew,
    toggleSide,
    setShowNew,
    createSession,
    startRename,
    deleteSession,
    closeTab,
    openIds,
  } = useSessions(
    useShallow((s) => ({
      sideOpen: s.sideOpen,
      showNew: s.showNew,
      toggleSide: s.toggleSide,
      setShowNew: s.setShowNew,
      createSession: s.createSession,
      startRename: s.startRename,
      deleteSession: s.deleteSession,
      closeTab: s.closeTab,
      openIds: s.openIds,
    })),
  );
  const active = useActiveSession();

  const [platform, setPlatform] = useState<Platform | ''>('');
  const [settingsAnchor, setSettingsAnchor] = useState<Anchor | null>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: Anchor } | null>(null);

  useEffect(() => {
    void window.api.app.platform().then(setPlatform);
  }, []);

  const isMac = platform === 'darwin';
  const title = active ? active.name : 'Claude Session Viewer';

  const handleCreate = (draft: NewSessionDraft) => {
    createSession({
      name: draft.name,
      path: draft.path,
      model: draft.model,
      systemPrompt: draft.systemPrompt,
    });
  };

  return (
    <div className={'app' + (sideOpen ? '' : ' side-collapsed')}>
      <TitleBar title={title} isMac={isMac} />
      <ActivityBar
        sideOpen={sideOpen}
        onToggleSide={toggleSide}
        onOpenSettings={(el) => setSettingsAnchor(rectAnchor(el, SETTINGS_WIDTH))}
      />
      <Sidebar
        onOpenMenu={(id, anchor) => setMenu({ id, anchor: menuAnchor(anchor) })}
      />

      <main className="main">
        <TabBar />
        {active ? (
          <SessionPane session={active} />
        ) : (
          <div className="main-placeholder">
            <strong>No session</strong>
            Pick a session from the sidebar.
          </div>
        )}
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

      {showNew && (
        <NewSessionPanel
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}

      {settingsAnchor && (
        <SettingsPopover
          anchor={settingsAnchor}
          theme={theme}
          density={density}
          onThemeChange={setTheme}
          onDensityChange={setDensity}
          onClose={() => setSettingsAnchor(null)}
        />
      )}

      {menu && (
        <ContextMenu
          anchor={menu.anchor}
          canCloseTab={openIds.includes(menu.id)}
          onRename={() => startRename(menu.id)}
          onCloseTab={() => closeTab(menu.id)}
          onDelete={() => deleteSession(menu.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
