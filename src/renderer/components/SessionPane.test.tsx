import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { SessionPane } from './SessionPane';
import { resetCannedCursor } from '../data/canned';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '../data/seed';
import { useSessions } from '../state/sessions';

function resetStore() {
  useSessions.setState({
    sessions: SEED_SESSIONS.map((s) => ({ ...s, turns: [...s.turns] })),
    openIds: [...SEED_OPEN_IDS],
    activeId: SEED_OPEN_IDS[0] ?? null,
    sideOpen: true,
    showNew: false,
    renamingId: null,
    drafts: {},
    typing: false,
  });
}

function getActive(): Session {
  return useSessions.getState().sessions.find((s) => s.id === SEED_OPEN_IDS[0])!;
}

describe('<SessionPane>', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCannedCursor();
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows EmptyState when the active session has no turns', () => {
    const session: Session = { ...getActive(), turns: [] };
    useSessions.setState({
      sessions: useSessions.getState().sessions.map((s) => (s.id === session.id ? session : s)),
    });
    render(<SessionPane session={session} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('transcript')).not.toBeInTheDocument();
  });

  it('shows the Transcript when the session has turns', () => {
    render(<SessionPane session={getActive()} />);
    expect(screen.getByTestId('transcript')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('renders the Composer with the current per-session draft', () => {
    const session = getActive();
    useSessions.setState({ drafts: { [session.id]: 'hello there' } });
    render(<SessionPane session={getActive()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello there');
  });

  it('typing in the composer writes to the per-session draft', async () => {
    vi.useRealTimers();
    const session = getActive();
    const user = userEvent.setup();
    render(<SessionPane session={session} />);
    await user.type(screen.getByRole('textbox'), 'hi');
    expect(useSessions.getState().drafts[session.id]).toBe('hi');
  });

  it('clicking a suggestion chip fills the draft', async () => {
    vi.useRealTimers();
    const session: Session = { ...getActive(), turns: [] };
    useSessions.setState({
      sessions: useSessions.getState().sessions.map((s) => (s.id === session.id ? session : s)),
    });
    const user = userEvent.setup();
    render(<SessionPane session={session} />);
    await user.click(screen.getByRole('button', { name: /explain the structure/i }));
    expect(useSessions.getState().drafts[session.id]).toBe('Explain the structure of this codebase');
  });

  it('sending appends a user turn, clears the draft, sets typing, then appends an assistant turn', async () => {
    const session = getActive();
    const startTurns = session.turns.length;
    useSessions.setState({ drafts: { [session.id]: 'fix the bug' } });

    render(<SessionPane session={getActive()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    // user turn appended, draft cleared, typing on
    let state = useSessions.getState();
    let currentSession = state.sessions.find((s) => s.id === session.id)!;
    expect(currentSession.turns).toHaveLength(startTurns + 1);
    expect(currentSession.turns[currentSession.turns.length - 1]?.role).toBe('user');
    expect(state.drafts[session.id]).toBe('');
    expect(state.typing).toBe(true);

    // after the delay the canned assistant reply lands
    await vi.advanceTimersByTimeAsync(800);
    state = useSessions.getState();
    currentSession = state.sessions.find((s) => s.id === session.id)!;
    expect(currentSession.turns).toHaveLength(startTurns + 2);
    expect(currentSession.turns[currentSession.turns.length - 1]?.role).toBe('assistant');
    expect(state.typing).toBe(false);
  });

  it('does not send when the draft is empty', () => {
    const session = getActive();
    const startTurns = session.turns.length;
    render(<SessionPane session={session} />);
    // send button is disabled when empty — pressing Enter in the textarea should also no-op
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    const current = useSessions.getState().sessions.find((s) => s.id === session.id)!;
    expect(current.turns).toHaveLength(startTurns);
    expect(useSessions.getState().typing).toBe(false);
  });

  it('cancels the pending canned reply when unmounted before it fires', async () => {
    const session = getActive();
    useSessions.setState({ drafts: { [session.id]: 'will be cancelled' } });
    const { unmount } = render(<SessionPane session={getActive()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    const turnsAfterSend =
      useSessions.getState().sessions.find((s) => s.id === session.id)!.turns.length;
    unmount();
    await vi.advanceTimersByTimeAsync(1000);
    const finalTurns =
      useSessions.getState().sessions.find((s) => s.id === session.id)!.turns.length;
    expect(finalTurns).toBe(turnsAfterSend);
  });
});
