import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '../data/seed';
import { useSessions } from '../state/sessions';
import { Sidebar } from './Sidebar';

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

describe('<Sidebar />', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('renders the session count and a row per session', () => {
    render(<Sidebar />);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(SEED_SESSIONS.length);
    expect(screen.getByText(String(SEED_SESSIONS.length))).toBeInTheDocument();
  });

  it('marks the active session', () => {
    render(<Sidebar />);
    const activeName = SEED_SESSIONS[0]!.name;
    const row = screen.getByText(activeName).closest('.session-item');
    expect(row).toHaveClass('active');
  });

  it('clicking a session updates activeId in the store', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const target = SEED_SESSIONS[2]!;
    await user.click(screen.getByText(target.name));
    expect(useSessions.getState().activeId).toBe(target.id);
  });

  it('clicking "New session" sets showNew to true', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /new session/i }));
    expect(useSessions.getState().showNew).toBe(true);
  });
});
