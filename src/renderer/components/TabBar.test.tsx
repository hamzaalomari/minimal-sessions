import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '../data/seed';
import { useSessions } from '../state/sessions';
import { TabBar } from './TabBar';

function resetStore() {
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

describe('<TabBar />', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('renders one tab per open session in order', () => {
    render(<TabBar />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(SEED_OPEN_IDS.length);
    const firstName = SEED_SESSIONS.find((s) => s.id === SEED_OPEN_IDS[0])!.name;
    expect(tabs[0]).toHaveTextContent(firstName);
  });

  it('marks the active tab', () => {
    render(<TabBar />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab makes it active', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    const second = SEED_OPEN_IDS[1]!;
    const tab = screen.getByTestId(`tab-${second}`);
    await user.click(tab);
    expect(useSessions.getState().activeId).toBe(second);
  });

  it('close button removes the tab', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    const first = SEED_SESSIONS.find((s) => s.id === SEED_OPEN_IDS[0])!;
    await user.click(screen.getByRole('button', { name: `Close ${first.name}` }));
    expect(useSessions.getState().openIds).not.toContain(first.id);
  });

  it('plus button opens the new-session panel', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByRole('button', { name: /^new session$/i }));
    expect(useSessions.getState().showNew).toBe(true);
  });
});
