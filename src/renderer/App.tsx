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

const MENU_WIDTH = 172;

/** Anchor a popover next to a chrome button on the left edge (e.g. activity bar's gear).
 *  Opens to the right of the button and grows upward from the button's bottom edge. */
function leftEdgePopAnchor(el: HTMLElement, gap = 8): Anchor {
  const r = el.getBoundingClientRect();
  return {
    left: r.right + gap,
    bottom: window.innerHeight - r.bottom,
  };
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
  const [settings, setSettings] = useState<{ anchor: Anchor; trigger: HTMLElement } | null>(null);
  const [menu, setMenu] = useState<{ id: string; anchor: Anchor } | null>(null);

  useEffect(() => {
    void window.api.app.platform().then(setPlatform);
  }, []);

  useEffect(() => {
    if (!useSessions.getState().hydrated) void useSessions.getState().hydrate();
  }, []);

  // Cmd/Ctrl+W (from the application menu): close the active tab if any,
  // otherwise fall back to closing the window. Read the latest store state at
  // event time so the handler stays valid as tabs come and go.
  useEffect(() => {
    return window.api.app.onRequestCloseTab(() => {
      const state = useSessions.getState();
      if (state.activeId && state.openIds.includes(state.activeId)) {
        state.closeTab(state.activeId);
      } else {
        void window.api.app.closeWindow();
      }
    });
  }, []);

  const isMac = platform === 'darwin';
  const title = active ? active.name : 'Claude Session Viewer';

  const handleCreate = (draft: NewSessionDraft) => {
    createSession({
      name: draft.name,
      path: draft.path,
      model: draft.model,
      systemPrompt: draft.systemPrompt,
      branch: draft.branch,
    });
  };

  return (
    <div className={'app' + (sideOpen ? '' : ' side-collapsed')}>
      <TitleBar title={title} isMac={isMac} />
      <ActivityBar
        sideOpen={sideOpen}
        onToggleSide={toggleSide}
        onOpenSettings={(el) =>
          setSettings((current) =>
            current ? null : { anchor: leftEdgePopAnchor(el), trigger: el },
          )
        }
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

      {settings && (
        <SettingsPopover
          anchor={settings.anchor}
          triggerEl={settings.trigger}
          theme={theme}
          density={density}
          onThemeChange={setTheme}
          onDensityChange={setDensity}
          onClose={() => setSettings(null)}
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
