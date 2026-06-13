import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
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
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { TweaksPanel } from './components/TweaksPanel';
import { UpdateBanner } from './components/UpdateBanner';
import { formatShortcut, setPlatform } from './lib/platform';
import { applyNavEntry, initNavTracking, useNav } from './state/nav';
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
  const setSidebarWidth = useTweaks((s) => s.setSidebarWidth);

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
    terminalOpenIds,
    toggleTerminalOpen,
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
      terminalOpenIds: s.terminalOpenIds,
      toggleTerminalOpen: s.toggleTerminalOpen,
    })),
  );
  const active = useActiveSession();

  const [platform, setPlatformLocal] = useState<Platform | ''>('');
  const [settings, setSettings] = useState<{ anchor: Anchor; trigger: HTMLElement } | null>(null);
  const [menu, setMenu] = useState<{
    id: string;
    anchor: Anchor;
    trigger: HTMLElement;
  } | null>(null);
  const [editingInstructionsFor, setEditingInstructionsFor] = useState<string | null>(null);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    void window.api.app.platform().then((p) => {
      setPlatformLocal(p);
      setPlatform(p);
    });
  }, []);

  useEffect(() => {
    if (!useSessions.getState().hydrated) void useSessions.getState().hydrate();
    initNavTracking();
  }, []);

  // Browser-style navigation. The main process forwards mouse buttons 4/5 and
  // Cmd/Ctrl+Alt+Left/Right via IPC; we also listen for the raw mouse buttons
  // here as a belt-and-braces safety net (some Linux WMs swallow app-command).
  useEffect(() => {
    const goBack = (): void => {
      const entry = useNav.getState().goBack();
      if (entry) applyNavEntry(entry);
    };
    const goForward = (): void => {
      const entry = useNav.getState().goForward();
      if (entry) applyNavEntry(entry);
    };
    const offBack = window.api.app.onRequestNavigateBack(goBack);
    const offForward = window.api.app.onRequestNavigateForward(goForward);
    const onMouseDown = (e: globalThis.MouseEvent): void => {
      // MouseEvent.button: 3 = back, 4 = forward on most platforms.
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      offBack();
      offForward();
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  // Track in-flight assistant turns at app scope so the sidebar status dot
  // updates even when the streaming session's pane isn't mounted.
  useEffect(() => {
    if (!window.api?.chat) return;
    const unsub = window.api.chat.onEvent((sid, event) => {
      const setStreaming = useSessions.getState().setStreaming;
      if (event.type === 'turn-start') setStreaming(sid, true);
      else if (event.type === 'turn-stop' || event.type === 'error') {
        setStreaming(sid, false);
      }
    });
    return unsub;
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
    const offTerminal = window.api.app.onRequestToggleTerminal(() => {
      const state = useSessions.getState();
      if (state.activeId) state.toggleTerminalOpen(state.activeId);
    });
    // Cycle through open tabs in order. Wraps in both directions so the
    // user can hammer the shortcut without hitting a dead end. No-op when
    // 0 or 1 tabs are open.
    const cycleTab = (delta: 1 | -1): void => {
      const state = useSessions.getState();
      const { openIds, activeId } = state;
      if (openIds.length < 2) return;
      const idx = activeId ? openIds.indexOf(activeId) : -1;
      const start = idx === -1 ? 0 : idx;
      const nextIdx = (start + delta + openIds.length) % openIds.length;
      const nextId = openIds[nextIdx];
      if (nextId) state.selectSession(nextId);
    };
    const offNextTab = window.api.app.onRequestNextTab(() => cycleTab(1));
    const offPrevTab = window.api.app.onRequestPrevTab(() => cycleTab(-1));
    const offShortcuts = window.api.app.onRequestToggleShortcuts(() => {
      setShowShortcuts((prev) => !prev);
    });
    return () => {
      offClose();
      offNew();
      offToggleSide();
      offSettings();
      offSelectTab();
      offSearch();
      offTerminal();
      offNextTab();
      offPrevTab();
      offShortcuts();
    };
  }, []);

  const isMac = platform === 'darwin';
  const title = 'Minimal Sessions';
  const editingSession = editingInstructionsFor
    ? sessions.find((s) => s.id === editingInstructionsFor) ?? null
    : null;

  /**
   * Open the embedded terminal with `claude login` queued — first-launch
   * authentication path for users whose SDK can't find existing credentials.
   *
   * If there's no active session, create a one-off "Setup" session at the
   * user's home directory so we have somewhere to host the PTY. The user
   * can delete it after auth.
   */
  const signInToClaude = async (): Promise<void> => {
    const state = useSessions.getState();
    let targetId = state.activeId;
    if (!targetId) {
      const home = await window.api.app.homeDir().catch(() => '~');
      const session = state.createSession({
        name: 'Claude Setup',
        path: home,
        model: 'claude-sonnet-4-6',
        systemPrompt: '',
        branch: '',
      });
      targetId = session.id;
    }
    state.setPendingTerminalCommand(targetId, 'claude login\n');
    if (!state.terminalOpenIds.includes(targetId)) {
      state.toggleTerminalOpen(targetId);
    } else {
      // Terminal already open — write directly since the consume hook only
      // fires on PTY open. Pop our own command and write it now.
      const cmd = state.consumePendingTerminalCommand(targetId);
      if (cmd) void window.api.terminal.write(targetId, cmd);
    }
    state.selectSession(targetId);
  };

  const handleCreate = async (draft: NewSessionDraft) => {
    let path = draft.path;
    let branch = draft.branch;
    // Run any git side-effect (new branch / new worktree) before we hand
    // the session off to the DB. If it fails we surface the error and stop
    // — no half-created session.
    if (draft.git.mode !== 'none') {
      try {
        const result = await window.api.fs.gitInitSession({
          path: draft.path,
          mode: draft.git.mode,
          ...(draft.git.name ? { name: draft.git.name } : {}),
        });
        path = result.path;
        branch = result.branch;
      } catch (e) {
        const message = (e as Error)?.message || 'Git operation failed';
        window.alert(message);
        return;
      }
    }
    createSession({
      name: draft.name,
      path,
      model: draft.model,
      systemPrompt: draft.systemPrompt,
      branch,
    });
  };

  /** Mouse-driven sidebar resize. Updates the --side-width CSS variable on
   *  every move for instant feedback; commits the final value to the tweaks
   *  store on mouseup so it persists across launches. */
  const onSideResizeStart = (e: ReactMouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const root = document.documentElement;
    const startX = e.clientX;
    const startWidth =
      parseFloat(getComputedStyle(root).getPropertyValue('--side-width')) || 268;
    const MIN = 200;
    const MAX = 600;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-resizing-side');

    const move = (ev: globalThis.MouseEvent): void => {
      const next = Math.max(MIN, Math.min(MAX, startWidth + (ev.clientX - startX)));
      root.style.setProperty('--side-width', `${next}px`);
    };
    const end = (): void => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      document.body.classList.remove('is-resizing-side');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      const finalW =
        parseFloat(getComputedStyle(root).getPropertyValue('--side-width')) || startWidth;
      setSidebarWidth(finalW);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
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
        onSelectAnalytics={() => setSidebarView('analytics')}
        onSelectPlugins={() => setSidebarView('plugins')}
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
      {sideOpen && (
        <div
          className="side-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize"
          onMouseDown={onSideResizeStart}
        />
      )}

      <main className="main">
        <TabBar />
        {active ? (
          <SessionPane session={active} />
        ) : (
          <div className="main-placeholder">
            <strong>No session</strong>
            Pick a session from the sidebar, or{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowNew(true)}
            >
              create a new one
            </button>
            .
            <div className="mp-auth">
              <span>First time setting up?</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => void signInToClaude()}
                data-testid="placeholder-sign-in"
              >
                Sign in to Claude
              </button>
            </div>
          </div>
        )}
      </main>

      <UpdateBanner />

      <footer className="statusbar">
        <div className="st-spacer" />
        {active && <TokenMeter session={active} />}
        <button
          className={
            'st-seg st-btn' +
            (active && terminalOpenIds.includes(active.id) ? ' on' : '')
          }
          onClick={() => active && toggleTerminalOpen(active.id)}
          title={`Toggle terminal (${formatShortcut('J')})`}
          aria-label="Toggle terminal"
          aria-pressed={!!active && terminalOpenIds.includes(active.id)}
          disabled={!active}
        >
          <Icon name="terminal" />
          <span>Terminal</span>
        </button>
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
          onSignInToClaude={() => {
            setSettings(null);
            void signInToClaude();
          }}
          onClose={() => setSettings(null)}
        />
      )}

      {showTweaks && <TweaksPanel onClose={() => setShowTweaks(false)} />}

      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

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
