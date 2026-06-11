import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '@shared/seed';
import { useSessions } from '../state/sessions';
import { Sidebar } from './Sidebar';

function resetStore() {
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
    searchQuery: '',
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

  it('history view lists deleted sessions and exposes Restore', async () => {
    const deleted = { ...SEED_SESSIONS[0]!, id: 'gone-1', name: 'gone' };
    useSessions.setState({ sidebarView: 'history', deletedSessions: [deleted] });
    const user = userEvent.setup();
    render(<Sidebar />);
    expect(screen.getByText('gone')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restore session/i }));
    const s = useSessions.getState();
    expect(s.sessions.find((x) => x.id === 'gone-1')).toBeDefined();
    expect(s.deletedSessions.find((x) => x.id === 'gone-1')).toBeUndefined();
  });

  it('history view shows a placeholder when empty', () => {
    useSessions.setState({ sidebarView: 'history', deletedSessions: [] });
    render(<Sidebar />);
    expect(screen.getByText(/no deleted sessions/i)).toBeInTheDocument();
  });

  it('clicking the trash button purges (after confirm) and removes from history', async () => {
    const deleted = { ...SEED_SESSIONS[0]!, id: 'gone-2', name: 'gone-2' };
    useSessions.setState({ sidebarView: 'history', deletedSessions: [deleted] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /delete session forever/i }));
    const s = useSessions.getState();
    expect(s.deletedSessions.find((x) => x.id === 'gone-2')).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it('search view filters open sessions by name', async () => {
    useSessions.setState({ sidebarView: 'search', searchQuery: '' });
    const user = userEvent.setup();
    render(<Sidebar />);
    const input = screen.getByRole('textbox', { name: /search sessions/i });
    await user.type(input, 'auth');
    const results = screen.getByTestId('search-results');
    expect(within(results).getByText('auth-service refactor')).toBeInTheDocument();
    expect(within(results).queryByText('marketing-site copy')).toBeNull();
  });

  it('search view filters by path too', async () => {
    useSessions.setState({ sidebarView: 'search', searchQuery: '' });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.type(screen.getByRole('textbox', { name: /search sessions/i }), 'internal');
    const results = screen.getByTestId('search-results');
    expect(within(results).getByText('data-pipeline debug')).toBeInTheDocument();
    expect(within(results).queryByText('auth-service refactor')).toBeNull();
  });

  it('search view shows separate Open / History sections with deleted matches', async () => {
    const deleted = { ...SEED_SESSIONS[0]!, id: 'gone-search', name: 'old-auth-stuff' };
    useSessions.setState({
      sidebarView: 'search',
      searchQuery: '',
      deletedSessions: [deleted],
    });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.type(screen.getByRole('textbox', { name: /search sessions/i }), 'auth');
    const results = screen.getByTestId('search-results');
    expect(within(results).getByText('auth-service refactor')).toBeInTheDocument();
    expect(within(results).getByText('old-auth-stuff')).toBeInTheDocument();
    // Open section appears before History — Open match is first in DOM order.
    const open = within(results).getByText('auth-service refactor');
    const hist = within(results).getByText('old-auth-stuff');
    expect(open.compareDocumentPosition(hist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('search view shows a hint and no results until the user types', () => {
    useSessions.setState({ sidebarView: 'search', searchQuery: '' });
    render(<Sidebar />);
    expect(screen.getByTestId('search-hint')).toBeInTheDocument();
    const results = screen.getByTestId('search-results');
    expect(within(results).queryByRole('listitem')).toBeNull();
    expect(within(results).queryByText(/open/i)).toBeNull();
    expect(within(results).queryByText(/history/i)).toBeNull();
  });

  it('search view shows a single "no match" message when the query has no results', () => {
    useSessions.setState({ sidebarView: 'search', searchQuery: 'zzznopezzz' });
    render(<Sidebar />);
    expect(screen.getByText(/no sessions match/i)).toBeInTheDocument();
    expect(screen.queryByTestId('search-hint')).toBeNull();
  });

  it('search view hides the Open section header when only history matches', async () => {
    const deleted = { ...SEED_SESSIONS[0]!, id: 'gone-only', name: 'lone-history' };
    useSessions.setState({
      sidebarView: 'search',
      searchQuery: 'lone-history',
      deletedSessions: [deleted],
    });
    render(<Sidebar />);
    const results = screen.getByTestId('search-results');
    expect(within(results).getByText('History')).toBeInTheDocument();
    expect(within(results).queryByText('Open')).toBeNull();
  });

  it('Esc clears the query while it has text, then returns to sessions view on the next Esc', async () => {
    useSessions.setState({ sidebarView: 'search', searchQuery: 'auth' });
    const user = userEvent.setup();
    render(<Sidebar />);
    const input = screen.getByRole('textbox', { name: /search sessions/i });
    input.focus();
    await user.keyboard('{Escape}');
    expect(useSessions.getState().searchQuery).toBe('');
    expect(useSessions.getState().sidebarView).toBe('search');
    await user.keyboard('{Escape}');
    expect(useSessions.getState().sidebarView).toBe('sessions');
  });

  it('cancelling the confirm leaves the session in history', async () => {
    const deleted = { ...SEED_SESSIONS[0]!, id: 'stay', name: 'stay' };
    useSessions.setState({ sidebarView: 'history', deletedSessions: [deleted] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /delete session forever/i }));
    expect(
      useSessions.getState().deletedSessions.find((x) => x.id === 'stay'),
    ).toBeDefined();
    confirmSpy.mockRestore();
  });
});
