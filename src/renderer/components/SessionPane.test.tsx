import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatEvent } from '@shared/api';
import type { Session, SessionId } from '@shared/types';
import { SessionPane } from './SessionPane';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '@shared/seed';
import { useSessions } from '../state/sessions';

type Emit = (sessionId: SessionId, event: ChatEvent) => void;

let emit: Emit | null = null;
let sendMock: ReturnType<typeof vi.fn>;
let stopMock: ReturnType<typeof vi.fn>;

function installChatApi() {
  sendMock = vi.fn().mockResolvedValue(undefined);
  stopMock = vi.fn().mockResolvedValue(undefined);
  // Minimal window.api covering only what SessionPane and the store touch.
  (window as unknown as { api: unknown }).api = {
    chat: {
      send: sendMock,
      stop: stopMock,
      onEvent: (handler: Emit) => {
        emit = handler;
        return () => {
          emit = null;
        };
      },
    },
    sessions: {
      updateSystemPrompt: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      purge: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      listDeleted: vi.fn().mockResolvedValue([]),
    },
    turns: {
      append: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    },
  };
}

function resetStore() {
  useSessions.setState({
    sessions: SEED_SESSIONS.map((s) => ({ ...s, turns: [...s.turns] })),
    deletedSessions: [],
    sidebarView: 'sessions',
    openIds: [...SEED_OPEN_IDS],
    activeId: SEED_OPEN_IDS[0] ?? null,
    sideOpen: true,
    showNew: false,
    renamingId: null,
    drafts: {},
    hydrated: true,
    home: '',
  });
}

function getActive(): Session {
  return useSessions.getState().sessions.find((s) => s.id === SEED_OPEN_IDS[0])!;
}

describe('<SessionPane>', () => {
  beforeEach(() => {
    localStorage.clear();
    installChatApi();
    resetStore();
  });

  afterEach(() => {
    emit = null;
  });

  it('shows EmptyState when the active session has no turns', () => {
    const session: Session = { ...getActive(), turns: [] };
    useSessions.setState({
      sessions: useSessions
        .getState()
        .sessions.map((s) => (s.id === session.id ? session : s)),
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
    const session = getActive();
    const user = userEvent.setup();
    render(<SessionPane session={session} />);
    await user.type(screen.getByRole('textbox'), 'hi');
    expect(useSessions.getState().drafts[session.id]).toBe('hi');
  });

  it('clicking a suggestion chip fills the draft', async () => {
    const session: Session = { ...getActive(), turns: [] };
    useSessions.setState({
      sessions: useSessions
        .getState()
        .sessions.map((s) => (s.id === session.id ? session : s)),
    });
    const user = userEvent.setup();
    render(<SessionPane session={session} />);
    await user.click(screen.getByRole('button', { name: /explain the structure/i }));
    expect(useSessions.getState().drafts[session.id]).toBe(
      'Explain the structure of this codebase',
    );
  });

  it('sending appends a user turn, invokes chat.send, and applies streamed assistant turn', async () => {
    const session = getActive();
    const startTurns = session.turns.length;
    useSessions.setState({ drafts: { [session.id]: 'fix the bug' } });

    render(<SessionPane session={getActive()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    // user turn appended optimistically, draft cleared, chat.send called
    let state = useSessions.getState();
    let currentSession = state.sessions.find((s) => s.id === session.id)!;
    expect(currentSession.turns).toHaveLength(startTurns + 1);
    expect(currentSession.turns[currentSession.turns.length - 1]?.role).toBe('user');
    expect(state.drafts[session.id]).toBe('');
    expect(sendMock).toHaveBeenCalledWith(session.id, 'fix the bug', '');

    // Stream a turn-start, a couple of deltas, and a turn-stop
    expect(emit).not.toBeNull();
    act(() => {
      emit!(session.id, { type: 'turn-start', turnId: 't-1', modelShort: 'Sonnet' });
      emit!(session.id, { type: 'text-delta', text: 'Hel' });
      emit!(session.id, { type: 'text-delta', text: 'lo' });
      emit!(session.id, {
        type: 'turn-stop',
        turnId: 't-1',
        blocks: [{ type: 'p', text: 'Hello' }],
        addTokens: 42,
      });
    });

    state = useSessions.getState();
    currentSession = state.sessions.find((s) => s.id === session.id)!;
    expect(currentSession.turns).toHaveLength(startTurns + 2);
    const last = currentSession.turns[currentSession.turns.length - 1]!;
    expect(last.role).toBe('assistant');
    expect(last.blocks[0]).toEqual({ type: 'p', text: 'Hello' });
    expect(currentSession.tokens).toBe(session.tokens + 42);
  });

  it('ignores events for other sessions', () => {
    const session = getActive();
    useSessions.setState({ drafts: { [session.id]: 'go' } });
    render(<SessionPane session={getActive()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    const turnsAfterUser = useSessions
      .getState()
      .sessions.find((s) => s.id === session.id)!.turns.length;

    act(() => {
      emit!('some-other-session', { type: 'turn-start', turnId: 'x' });
      emit!('some-other-session', {
        type: 'turn-stop',
        turnId: 'x',
        blocks: [{ type: 'p', text: 'wrong' }],
        addTokens: 0,
      });
    });

    const finalTurns = useSessions
      .getState()
      .sessions.find((s) => s.id === session.id)!.turns.length;
    expect(finalTurns).toBe(turnsAfterUser);
  });

  it('does not send when the draft is empty', () => {
    const session = getActive();
    const startTurns = session.turns.length;
    render(<SessionPane session={session} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    const current = useSessions.getState().sessions.find((s) => s.id === session.id)!;
    expect(current.turns).toHaveLength(startTurns);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('clicking the stop button optimistically finalizes the streaming turn with "Stopped."', async () => {
    const session = getActive();
    const startTurns = session.turns.length;
    useSessions.setState({ drafts: { [session.id]: 'do it' } });
    render(<SessionPane session={getActive()} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    // Open a stream + stream some partial content.
    act(() => {
      emit!(session.id, { type: 'turn-start', turnId: 't-stop', modelShort: 'Sonnet' });
      emit!(session.id, { type: 'text-delta', text: 'Working on' });
    });

    fireEvent.click(screen.getByRole('button', { name: /stop generating/i }));
    expect(stopMock).toHaveBeenCalledWith(session.id);

    // The assistant turn is appended immediately (user turn + assistant turn = +2).
    const current = useSessions.getState().sessions.find((s) => s.id === session.id)!;
    expect(current.turns).toHaveLength(startTurns + 2);
    const asst = current.turns[current.turns.length - 1]!;
    expect(asst.role).toBe('assistant');
    expect(asst.blocks).toEqual([
      { type: 'p', text: 'Working on' },
      { type: 'p', text: 'Stopped.' },
    ]);

    // The eventual late turn-stop must not double-append.
    act(() => {
      emit!(session.id, {
        type: 'turn-stop',
        turnId: 't-stop',
        blocks: [{ type: 'p', text: 'Stopped.' }],
        addTokens: 0,
        addUsage: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
        sdkSessionId: 'sdk-late',
      });
    });
    const after = useSessions.getState().sessions.find((s) => s.id === session.id)!;
    expect(after.turns).toHaveLength(startTurns + 2);
    expect(after.sdkSessionId).toBe('sdk-late');
  });

  it('renders an error turn when chat.send rejects', async () => {
    sendMock.mockRejectedValueOnce(new Error('boom'));
    const session = getActive();
    const startTurns = session.turns.length;
    useSessions.setState({ drafts: { [session.id]: 'go' } });
    render(<SessionPane session={getActive()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const final = useSessions.getState().sessions.find((s) => s.id === session.id)!;
    expect(final.turns).toHaveLength(startTurns + 2);
    const last = final.turns[final.turns.length - 1]!;
    expect(last.role).toBe('assistant');
    expect(last.blocks[0]).toMatchObject({ type: 'error', message: 'boom' });
  });
});
