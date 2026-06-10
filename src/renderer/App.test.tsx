import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, Platform } from '@shared/api';
import { App } from './App';
import { SEED_OPEN_IDS, SEED_SESSIONS } from './data/seed';
import { useSessions } from './state/sessions';
import { useTweaks } from './state/tweaks';

function installApi(platform: Platform = 'darwin'): Api {
  const api: Api = {
    app: {
      ping: vi.fn().mockResolvedValue('pong' as const),
      platform: vi.fn().mockResolvedValue(platform),
    },
  };
  (window as unknown as { api: Api }).api = api;
  return api;
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
    openIds: [...SEED_OPEN_IDS],
    activeId: SEED_OPEN_IDS[0] ?? null,
    sideOpen: true,
    showNew: false,
    renamingId: null,
    drafts: {},
    typing: false,
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

  it('renders traffic light dots on macOS', async () => {
    installApi('darwin');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.traffic')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.tdot')).toHaveLength(3);
  });

  it('hides traffic light dots on non-mac platforms', async () => {
    installApi('win32');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(window.api.app.platform).toHaveBeenCalled();
    });
    expect(container.querySelector('.traffic')).not.toBeInTheDocument();
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
});
