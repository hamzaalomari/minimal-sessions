import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, Platform } from '@shared/api';
import { App } from './App';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '@shared/seed';
import { useSessions } from './state/sessions';
import { useTweaks } from './state/tweaks';

function installApi(
  platform: Platform = 'darwin',
): Api & { __fireCloseTab: () => void } {
  let closeTabHandler: (() => void) | null = null;
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
    },
    fs: {
      pickDirectory: vi.fn().mockResolvedValue('/Users/h/dev/fresh'),
      branchFor: vi.fn().mockResolvedValue('main'),
      isReadableDir: vi.fn().mockResolvedValue(true),
    },
    models: {
      list: vi.fn().mockResolvedValue([]),
    },
    chat: {
      send: vi.fn().mockResolvedValue(undefined),
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
  };
  (window as unknown as { api: Api }).api = api;
  return Object.assign(api, {
    __fireCloseTab: () => closeTabHandler?.(),
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

  it('renders the title bar with the active session name', async () => {
    installApi('darwin');
    render(<App />);
    const activeName = SEED_SESSIONS.find((s) => s.id === SEED_OPEN_IDS[0])!.name;
    expect(screen.getByText(activeName, { selector: '.title-name' })).toBeInTheDocument();
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
    expect(screen.getAllByRole('tab')).toHaveLength(SEED_OPEN_IDS.length);
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
