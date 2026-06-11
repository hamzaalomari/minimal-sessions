import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Platform } from '@shared/api';
import { ActivityBar } from './components/ActivityBar';
import { ContextMenu, type Anchor } from './components/ContextMenu';
import { EditInstructionsModal } from './components/EditInstructionsModal';
import { Icon } from './components/Icon';
import { NewSessionPanel, type NewSessionDraft } from './components/NewSessionPanel';
import { SessionPane } from './components/SessionPane';
import { SettingsPopover } from './components/SettingsPopover';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TitleBar } from './components/TitleBar';
import { TokenMeter } from './components/TokenMeter';
import { TweaksPanel } from './components/TweaksPanel';
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
    sessions,
    sidebarView,
    sideOpen,
    showNew,
    toggleSide,
    setShowNew,
    setSidebarView,
    createSession,
    startRename,
    deleteSession,
    closeTab,
    updateSystemPrompt,
    openIds,
  } = useSessions(
    useShallow((s) => ({
      sessions: s.sessions,
      sidebarView: s.sidebarView,
      sideOpen: s.sideOpen,
      showNew: s.showNew,
      toggleSide: s.toggleSide,
      setShowNew: s.setShowNew,
      setSidebarView: s.setSidebarView,
      createSession: s.createSession,
      startRename: s.startRename,
      deleteSession: s.deleteSession,
      closeTab: s.closeTab,
      updateSystemPrompt: s.updateSystemPrompt,
      openIds: s.openIds,
    })),
  );
  const active = useActiveSession();

  const [platform, setPlatform] = useState<Platform | ''>('');
  const [settings, setSettings] = useState<{ anchor: Anchor; trigger: HTMLElement } | null>(null);
  const [menu, setMenu] = useState<{
    id: string;
    anchor: Anchor;
    trigger: HTMLElement;
  } | null>(null);
  const [editingInstructionsFor, setEditingInstructionsFor] = useState<string | null>(null);
  const [showTweaks, setShowTweaks] = useState(false);

  useEffect(() => {
    void window.api.app.platform().then(setPlatform);
  }, []);

  useEffect(() => {
    if (!useSessions.getState().hydrated) void useSessions.getState().hydrate();
  }, []);

  // Keyboard shortcuts fired by the native application menu. Each handler reads
  // the latest store state at event time so it stays valid as tabs / sessions
  // come and go.
  useEffect(() => {
    const offClose = window.api.app.onRequestCloseTab(() => {
      const state = useSessions.getState();
      if (state.activeId && state.openIds.includes(state.activeId)) {
        state.closeTab(state.activeId);
      } else {
        void window.api.app.closeWindow();
      }
    });
    const offNew = window.api.app.onRequestNewSession(() => {
      useSessions.getState().setShowNew(true);
    });
    const offToggleSide = window.api.app.onRequestToggleSidebar(() => {
      useSessions.getState().toggleSide();
    });
    const offSettings = window.api.app.onRequestOpenSettings(() => {
      // Re-use the gear button's click handler so the toggle / anchor logic
      // lives in one place. The button is always rendered in <ActivityBar>.
      const gear = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Settings"]',
      );
      gear?.click();
    });
    const offSelectTab = window.api.app.onRequestSelectTab((n) => {
      const state = useSessions.getState();
      const id = state.openIds[n - 1];
      if (id) state.selectSession(id);
    });
    const offSearch = window.api.app.onRequestOpenSearch(() => {
      const state = useSessions.getState();
      if (!state.sideOpen) state.toggleSide();
      state.setSidebarView('search');
    });
    return () => {
      offClose();
      offNew();
      offToggleSide();
      offSettings();
      offSelectTab();
      offSearch();
    };
  }, []);

  const isMac = platform === 'darwin';
  const title = 'Minimal Sessions';
  const editingSession = editingInstructionsFor
    ? sessions.find((s) => s.id === editingInstructionsFor) ?? null
    : null;

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
        sidebarView={sidebarView}
        onToggleSide={toggleSide}
        onSelectSessions={() => setSidebarView('sessions')}
        onSelectHistory={() => setSidebarView('history')}
        onOpenSearch={() => {
          if (!sideOpen) toggleSide();
          setSidebarView('search');
        }}
        onOpenSettings={(el) =>
          setSettings((current) =>
            current ? null : { anchor: leftEdgePopAnchor(el), trigger: el },
          )
        }
      />
      <Sidebar
        onOpenMenu={(id, anchor) =>
          setMenu((current) =>
            current && current.id === id
              ? null
              : { id, anchor: menuAnchor(anchor), trigger: anchor },
          )
        }
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
        {active && <TokenMeter session={active} />}
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
          onOpenTweaks={() => {
            setSettings(null);
            setShowTweaks(true);
          }}
          onClose={() => setSettings(null)}
        />
      )}

      {showTweaks && <TweaksPanel onClose={() => setShowTweaks(false)} />}

      {menu && (
        <ContextMenu
          anchor={menu.anchor}
          triggerEl={menu.trigger}
          canCloseTab={openIds.includes(menu.id)}
          onRename={() => startRename(menu.id)}
          onEditInstructions={() => setEditingInstructionsFor(menu.id)}
          onCloseTab={() => closeTab(menu.id)}
          onDelete={() => deleteSession(menu.id)}
          onClose={() => setMenu(null)}
        />
      )}

      {editingSession && (
        <EditInstructionsModal
          session={editingSession}
          onClose={() => setEditingInstructionsFor(null)}
          onSave={(prompt) => {
            updateSystemPrompt(editingSession.id, prompt);
            setEditingInstructionsFor(null);
          }}
        />
      )}

    </div>
  );
}
