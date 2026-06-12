import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, Platform } from '@shared/api';
import { App } from './App';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '@shared/seed';
import { useSessions } from './state/sessions';
import { useTweaks } from './state/tweaks';

interface MenuFiringApi {
  __fireCloseTab: () => void;
  __fireNewSession: () => void;
  __fireToggleSidebar: () => void;
  __fireOpenSettings: () => void;
  __fireSelectTab: (n: number) => void;
  __fireOpenSearch: () => void;
}

function installApi(platform: Platform = 'darwin'): Api & MenuFiringApi {
  let closeTabHandler: (() => void) | null = null;
  let newSessionHandler: (() => void) | null = null;
  let toggleSidebarHandler: (() => void) | null = null;
  let openSettingsHandler: (() => void) | null = null;
  let selectTabHandler: ((n: number) => void) | null = null;
  let openSearchHandler: (() => void) | null = null;
  const api: Api = {
    app: {
      ping: vi.fn().mockResolvedValue('pong' as const),
      platform: vi.fn().mockResolvedValue(platform),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      homeDir: vi.fn().mockResolvedValue('/Users/h'),
      onRequestCloseTab: vi.fn((handler: () => void) => {
        closeTabHandler = handler;
        return () => {
          closeTabHandler = null;
        };
      }),
      onRequestNewSession: vi.fn((handler: () => void) => {
        newSessionHandler = handler;
        return () => {
          newSessionHandler = null;
        };
      }),
      onRequestToggleSidebar: vi.fn((handler: () => void) => {
        toggleSidebarHandler = handler;
        return () => {
          toggleSidebarHandler = null;
        };
      }),
      onRequestOpenSettings: vi.fn((handler: () => void) => {
        openSettingsHandler = handler;
        return () => {
          openSettingsHandler = null;
        };
      }),
      onRequestSelectTab: vi.fn((handler: (n: number) => void) => {
        selectTabHandler = handler;
        return () => {
          selectTabHandler = null;
        };
      }),
      onRequestOpenSearch: vi.fn((handler: () => void) => {
        openSearchHandler = handler;
        return () => {
          openSearchHandler = null;
        };
      }),
      onRequestToggleTerminal: vi.fn(() => () => {}),
      onRequestNavigateBack: vi.fn(() => () => {}),
      onRequestNavigateForward: vi.fn(() => () => {}),
    },
    fs: {
      pickDirectory: vi.fn().mockResolvedValue('/Users/h/dev/fresh'),
      branchFor: vi.fn().mockResolvedValue('main'),
      isReadableDir: vi.fn().mockResolvedValue(true),
    },
    models: {
      list: vi.fn().mockResolvedValue([]),
    },
    commands: {
      list: vi.fn().mockResolvedValue([]),
    },
    chat: {
      send: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      onEvent: vi.fn(() => () => {}),
    },
    sessions: {
      list: vi.fn().mockResolvedValue([]),
      listDeleted: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      updateSystemPrompt: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      purge: vi.fn().mockResolvedValue(undefined),
    },
    turns: {
      list: vi.fn().mockResolvedValue([]),
      append: vi.fn().mockResolvedValue(undefined),
    },
    terminal: {
      open: vi.fn().mockResolvedValue({ reused: false }),
      write: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
    },
  };
  (window as unknown as { api: Api }).api = api;
  return Object.assign(api, {
    __fireCloseTab: () => closeTabHandler?.(),
    __fireNewSession: () => newSessionHandler?.(),
    __fireToggleSidebar: () => toggleSidebarHandler?.(),
    __fireOpenSettings: () => openSettingsHandler?.(),
    __fireSelectTab: (n: number) => selectTabHandler?.(n),
    __fireOpenSearch: () => openSearchHandler?.(),
  });
}

function resetStores() {
  useTweaks.setState({
    theme: 'light',
    accent: '#c4663f',
    readFont: 'sans',
    density: 'cozy',
  });
  useSessions.setState({
    sessions: [...SEED_SESSIONS],
    deletedSessions: [],
    sidebarView: 'sessions',
    openIds: [...SEED_OPEN_IDS],
    activeId: SEED_OPEN_IDS[0] ?? null,
    sideOpen: true,
    showNew: false,
    renamingId: null,
    drafts: {},
    hydrated: true,
    home: '/Users/h',
    searchQuery: '',
    terminalOpenIds: [],
  });
}

describe('<App />', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStores();
  });

  afterEach(() => {
    delete (window as unknown as { api?: Api }).api;
  });

  it('renders the title bar with the app name (not the active session name)', async () => {
    installApi('darwin');
    render(<App />);
    expect(
      screen.getByText('Minimal Sessions', { selector: '.title-name' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.api.app.platform).toHaveBeenCalled();
    });
  });

  it('renders the activity bar with sessions/search/settings buttons', async () => {
    installApi('darwin');
    render(<App />);
    expect(
      screen.getByRole('button', { name: /toggle sessions sidebar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
  });

  it('renders the sidebar and tab bar from seed data', async () => {
    installApi('darwin');
    render(<App />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(SEED_SESSIONS.length);
    const tabBar = screen.getByRole('tablist', { name: 'Open sessions' });
    expect(within(tabBar).getAllByRole('tab')).toHaveLength(SEED_OPEN_IDS.length);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
  });

  it('renders the transcript for the active session', async () => {
    installApi('darwin');
    render(<App />);
    const active = SEED_SESSIONS.find((s) => s.id === SEED_OPEN_IDS[0])!;
    expect(screen.getByTestId('transcript')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(active.name);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
  });

  it('shows the empty placeholder when no session is active', async () => {
    installApi('darwin');
    useSessions.setState({ activeId: null, openIds: [] });
    render(<App />);
    expect(screen.queryByTestId('transcript')).not.toBeInTheDocument();
    expect(screen.getByText(/pick a session from the sidebar/i)).toBeInTheDocument();
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
  });

  it('marks the title bar with .mac on macOS so native traffic lights get clearance', async () => {
    installApi('darwin');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.titlebar.mac')).toBeInTheDocument();
    });
  });

  it('leaves the title bar unmarked on non-mac platforms', async () => {
    installApi('win32');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(window.api.app.platform).toHaveBeenCalled();
    });
    expect(container.querySelector('.titlebar.mac')).not.toBeInTheDocument();
  });

  it('theme toggle flips light ↔ dark', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    expect(btn).toHaveTextContent(/dark/i);
    await user.click(btn);
    expect(useTweaks.getState().theme).toBe('dark');
  });

  it('sidebar toggle collapses the side panel', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(container.querySelector('.app')).not.toHaveClass('side-collapsed');
    await user.click(screen.getByRole('button', { name: /toggle sessions sidebar/i }));
    expect(container.querySelector('.app')).toHaveClass('side-collapsed');
  });

  it('settings button toggles the popover open and closed', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    const gear = screen.getByRole('button', { name: /^settings$/i });
    expect(screen.queryByTestId('settings-popover')).not.toBeInTheDocument();
    await user.click(gear);
    expect(screen.getByTestId('settings-popover')).toBeInTheDocument();
    await user.click(gear);
    expect(screen.queryByTestId('settings-popover')).not.toBeInTheDocument();
  });

  it('sidebar kebab opens the context menu for that session', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    const kebabs = screen.getAllByRole('button', { name: /session options/i });
    expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    await user.click(kebabs[0]!);
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
  });

  it('context menu delete removes the session from the store', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    const before = useSessions.getState().sessions.length;
    const kebabs = screen.getAllByRole('button', { name: /session options/i });
    await user.click(kebabs[0]!);
    await user.click(screen.getByRole('button', { name: /delete session/i }));
    expect(useSessions.getState().sessions.length).toBe(before - 1);
  });

  it('plus button opens the new session panel', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByTestId('new-session-panel')).not.toBeInTheDocument();
    const newBtns = screen.getAllByRole('button', { name: /^new session$/i });
    await user.click(newBtns[0]!);
    expect(screen.getByTestId('new-session-panel')).toBeInTheDocument();
  });

  it('Cmd+W (request-close-tab) closes the active tab when one is open', async () => {
    const api = installApi('darwin');
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    const initialActive = SEED_OPEN_IDS[0]!;
    expect(useSessions.getState().openIds).toContain(initialActive);
    api.__fireCloseTab();
    expect(useSessions.getState().openIds).not.toContain(initialActive);
  });

  it('Cmd+W falls back to closeWindow when no tabs are open', async () => {
    const api = installApi('darwin');
    useSessions.setState({ openIds: [], activeId: null });
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    api.__fireCloseTab();
    expect(api.app.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('Cmd+N (request-new-session) opens the new-session panel', async () => {
    const api = installApi('darwin');
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    expect(screen.queryByTestId('new-session-panel')).not.toBeInTheDocument();
    act(() => api.__fireNewSession());
    expect(screen.getByTestId('new-session-panel')).toBeInTheDocument();
  });

  it('Cmd+\\ (request-toggle-sidebar) collapses and re-expands the sidebar', async () => {
    const api = installApi('darwin');
    const { container } = render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    expect(container.querySelector('.app')).not.toHaveClass('side-collapsed');
    act(() => api.__fireToggleSidebar());
    expect(container.querySelector('.app')).toHaveClass('side-collapsed');
    act(() => api.__fireToggleSidebar());
    expect(container.querySelector('.app')).not.toHaveClass('side-collapsed');
  });

  it('Cmd+, (request-open-settings) opens the settings popover', async () => {
    const api = installApi('darwin');
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    expect(screen.queryByTestId('settings-popover')).not.toBeInTheDocument();
    act(() => api.__fireOpenSettings());
    expect(screen.getByTestId('settings-popover')).toBeInTheDocument();
  });

  it('Cmd+F (request-open-search) switches the sidebar to the search view and expands it', async () => {
    const api = installApi('darwin');
    // Start with the sidebar collapsed to verify the handler also re-opens it.
    useSessions.setState({ sideOpen: false });
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    act(() => api.__fireOpenSearch());
    const state = useSessions.getState();
    expect(state.sidebarView).toBe('search');
    expect(state.sideOpen).toBe(true);
  });

  it('Cmd+1..9 (request-select-tab) focuses the Nth open tab', async () => {
    const api = installApi('darwin');
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    const targetId = SEED_OPEN_IDS[1];
    if (!targetId) throw new Error('SEED_OPEN_IDS needs at least 2 entries for this test');
    expect(useSessions.getState().activeId).not.toBe(targetId);
    api.__fireSelectTab(2);
    expect(useSessions.getState().activeId).toBe(targetId);
  });

  it('Cmd+N (request-select-tab) with N greater than open tabs is a no-op', async () => {
    const api = installApi('darwin');
    render(<App />);
    await waitFor(() => expect(window.api.app.platform).toHaveBeenCalled());
    const before = useSessions.getState().activeId;
    api.__fireSelectTab(99);
    expect(useSessions.getState().activeId).toBe(before);
  });

  it('creating a session via the panel adds it to the store and closes the panel', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);
    const before = useSessions.getState().sessions.length;
    const newBtns = screen.getAllByRole('button', { name: /^new session$/i });
    await user.click(newBtns[0]!);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/fresh');
    await user.type(screen.getByLabelText(/session name/i), 'fresh start');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    const after = useSessions.getState().sessions;
    expect(after.length).toBe(before + 1);
    expect(after[0]?.name).toBe('fresh start');
    expect(after[0]?.branch).toBe('main');
    expect(screen.queryByTestId('new-session-panel')).not.toBeInTheDocument();
  });
});
