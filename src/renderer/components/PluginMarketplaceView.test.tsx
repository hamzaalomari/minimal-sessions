import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@shared/api';
import { PluginMarketplaceView } from './PluginMarketplaceView';
import { MARKETPLACE_PLUGINS } from '../data/plugin-marketplace';
import { useSessions } from '../state/sessions';

function installMinimalApi(): void {
  const api: Partial<Api> = {
    app: {
      ping: vi.fn().mockResolvedValue('pong' as const),
      platform: vi.fn().mockResolvedValue('darwin'),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      homeDir: vi.fn().mockResolvedValue('/Users/h'),
      openExternal: vi.fn().mockResolvedValue(undefined),
      onRequestCloseTab: vi.fn(() => () => {}),
      onRequestNewSession: vi.fn(() => () => {}),
      onRequestToggleSidebar: vi.fn(() => () => {}),
      onRequestOpenSettings: vi.fn(() => () => {}),
      onRequestOpenSearch: vi.fn(() => () => {}),
      onRequestToggleTerminal: vi.fn(() => () => {}),
      onRequestSelectTab: vi.fn(() => () => {}),
      onRequestNavigateBack: vi.fn(() => () => {}),
      onRequestNavigateForward: vi.fn(() => () => {}),
      onRequestNextTab: vi.fn(() => () => {}),
      onRequestPrevTab: vi.fn(() => () => {}),
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
  (window as unknown as { api: Partial<Api> }).api = api;
}

function resetStore(): void {
  useSessions.setState({
    sessions: [
      {
        id: 'sess-1',
        name: 'Test',
        path: '/Users/h/dev/x',
        model: 'claude-sonnet-4-6',
        branch: 'main',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        turns: [],
        tokens: 0,
        tokensIn: 0,
        tokensOut: 0,
        tokensCacheWrite: 0,
        tokensCacheRead: 0,
        systemPrompt: '',
        sdkSessionId: null,
        deletedAt: null,
      },
    ],
    deletedSessions: [],
    sidebarView: 'plugins',
    openIds: ['sess-1'],
    activeId: 'sess-1',
    sideOpen: true,
    showNew: false,
    renamingId: null,
    drafts: {},
    hydrated: true,
    home: '/Users/h',
    searchQuery: '',
    terminalOpenIds: ['sess-1'],
    streamingIds: [],
    pendingTerminalCommands: {},
    dispatchedInstalls: [],
  });
}

describe('<PluginMarketplaceView />', () => {
  beforeEach(() => {
    installMinimalApi();
    resetStore();
  });

  it('renders the full curated list by default', () => {
    render(<PluginMarketplaceView />);
    for (const p of MARKETPLACE_PLUGINS) {
      expect(screen.getByTestId(`plug-${p.installId}`)).toBeInTheDocument();
    }
  });

  it('filters by the search box, matching name/description/tags', async () => {
    const user = userEvent.setup();
    render(<PluginMarketplaceView />);
    await user.type(screen.getByLabelText(/Search plugins/i), 'superpower');
    expect(screen.getByTestId('plug-superpowers@obra')).toBeInTheDocument();
    // Others should drop out.
    expect(
      screen.queryByTestId('plug-claude-command-suite@qdhenry'),
    ).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    render(<PluginMarketplaceView />);
    await user.type(
      screen.getByLabelText(/Search plugins/i),
      'zzz-no-such-plugin',
    );
    expect(screen.getByText(/No plugins match/i)).toBeInTheDocument();
  });

  it('filters by tag chip and toggles off when re-clicked', async () => {
    const user = userEvent.setup();
    render(<PluginMarketplaceView />);
    const indexChip = screen.getAllByRole('button', { name: 'index' })[0]!;
    await user.click(indexChip);
    expect(
      screen.getByTestId('plug-awesome-claude-code@hesreallyhim'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('plug-superpowers@obra')).toBeNull();
    // Re-click → clears filter.
    await user.click(indexChip);
    expect(screen.getByTestId('plug-superpowers@obra')).toBeInTheDocument();
  });

  it('marks a plugin as dispatched after running the confirm flow', async () => {
    const user = userEvent.setup();
    render(<PluginMarketplaceView />);
    const card = screen.getByTestId('plug-superpowers@obra');
    await user.click(within(card).getByRole('button', { name: /^Install$/ }));
    await user.click(screen.getByRole('button', { name: /Run install/ }));
    // After dispatch the card shows the badge + CTA flips to Re-install.
    const updatedCard = screen.getByTestId('plug-superpowers@obra');
    expect(within(updatedCard).getByText('Dispatched')).toBeInTheDocument();
    expect(
      within(updatedCard).getByRole('button', { name: /Re-install/ }),
    ).toBeInTheDocument();
    expect(useSessions.getState().dispatchedInstalls).toContain(
      'superpowers@obra',
    );
  });
});
