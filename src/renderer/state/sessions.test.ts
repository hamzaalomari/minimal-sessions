import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '@shared/seed';
import { useSessions } from './sessions';

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
    hydrated: true,
    home: '',
  });
}

describe('sessions store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('seeds with sessions, two open tabs, and the first as active', () => {
    const s = useSessions.getState();
    expect(s.sessions).toHaveLength(SEED_SESSIONS.length);
    expect(s.openIds).toEqual(SEED_OPEN_IDS);
    expect(s.activeId).toBe(SEED_OPEN_IDS[0]);
  });

  describe('selectSession', () => {
    it('switches activeId without re-adding an already-open tab', () => {
      const second = SEED_OPEN_IDS[1]!;
      act(() => useSessions.getState().selectSession(second));
      const s = useSessions.getState();
      expect(s.activeId).toBe(second);
      expect(s.openIds).toEqual(SEED_OPEN_IDS);
    });

    it('opens a new tab when selecting a session that is not open', () => {
      const closed = SEED_SESSIONS[2]!.id;
      act(() => useSessions.getState().selectSession(closed));
      const s = useSessions.getState();
      expect(s.openIds).toContain(closed);
      expect(s.activeId).toBe(closed);
    });
  });

  describe('closeTab', () => {
    it('removes the id from openIds', () => {
      const first = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().closeTab(first));
      expect(useSessions.getState().openIds).not.toContain(first);
    });

    it('moves activeId to the previous tab when the active tab is closed', () => {
      const first = SEED_OPEN_IDS[0]!;
      const second = SEED_OPEN_IDS[1]!;
      act(() => useSessions.getState().closeTab(first));
      expect(useSessions.getState().activeId).toBe(second);
    });

    it('falls back to null when the last tab is closed', () => {
      act(() => {
        SEED_OPEN_IDS.forEach((id) => useSessions.getState().closeTab(id));
      });
      expect(useSessions.getState().openIds).toEqual([]);
      expect(useSessions.getState().activeId).toBeNull();
    });
  });

  describe('reorderTabs', () => {
    it('moves a tab in front of the target', () => {
      const [a, b] = SEED_OPEN_IDS as [string, string];
      act(() => useSessions.getState().reorderTabs(b, a));
      expect(useSessions.getState().openIds).toEqual([b, a]);
    });

    it('is a no-op when drag === target', () => {
      const first = SEED_OPEN_IDS[0]!;
      const before = [...useSessions.getState().openIds];
      act(() => useSessions.getState().reorderTabs(first, first));
      expect(useSessions.getState().openIds).toEqual(before);
    });
  });

  describe('createSession', () => {
    it('prepends a new session, opens it, and makes it active', () => {
      let created;
      act(() => {
        created = useSessions.getState().createSession({
          name: 'New thing',
          path: '~/dev/new',
          model: 'claude-sonnet-4-6',
        });
      });
      const s = useSessions.getState();
      expect(s.sessions[0]).toMatchObject({ name: 'New thing' });
      expect(s.activeId).toBe(created!.id);
      expect(s.openIds).toContain(created!.id);
      expect(s.showNew).toBe(false);
    });
  });

  describe('deleteSession (soft-delete)', () => {
    it('drops the tab + draft and moves the session into deletedSessions', () => {
      const id = SEED_OPEN_IDS[0]!;
      const before = useSessions.getState().sessions.find((x) => x.id === id)!;
      act(() => useSessions.getState().setDraft(id, 'hi'));
      act(() => useSessions.getState().deleteSession(id));
      const s = useSessions.getState();
      expect(s.sessions.find((x) => x.id === id)).toBeUndefined();
      expect(s.deletedSessions[0]?.id).toBe(before.id);
      expect(s.openIds).not.toContain(id);
      expect(s.drafts[id]).toBeUndefined();
    });
  });

  describe('restoreSession', () => {
    it('moves a deleted session back to the active list', () => {
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().deleteSession(id));
      expect(useSessions.getState().sessions.find((x) => x.id === id)).toBeUndefined();
      act(() => useSessions.getState().restoreSession(id));
      const s = useSessions.getState();
      expect(s.sessions.find((x) => x.id === id)).toBeDefined();
      expect(s.deletedSessions.find((x) => x.id === id)).toBeUndefined();
    });

    it('is a no-op when the id is not in the deleted bucket', () => {
      const before = useSessions.getState();
      act(() => useSessions.getState().restoreSession('nope'));
      const after = useSessions.getState();
      expect(after.sessions).toEqual(before.sessions);
      expect(after.deletedSessions).toEqual(before.deletedSessions);
    });
  });

  describe('rename', () => {
    it('commitRename writes a trimmed new name', () => {
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().startRename(id));
      expect(useSessions.getState().renamingId).toBe(id);
      act(() => useSessions.getState().commitRename(id, '  renamed  '));
      const s = useSessions.getState();
      expect(s.renamingId).toBeNull();
      expect(s.sessions.find((x) => x.id === id)?.name).toBe('renamed');
    });

    it('commitRename with null or empty string keeps the old name', () => {
      const id = SEED_OPEN_IDS[0]!;
      const before = useSessions.getState().sessions.find((x) => x.id === id)!.name;
      act(() => useSessions.getState().commitRename(id, null));
      expect(useSessions.getState().sessions.find((x) => x.id === id)?.name).toBe(before);
      act(() => useSessions.getState().commitRename(id, '   '));
      expect(useSessions.getState().sessions.find((x) => x.id === id)?.name).toBe(before);
    });
  });

  describe('sidebar + new session toggles', () => {
    it('toggleSide flips sideOpen', () => {
      act(() => useSessions.getState().toggleSide());
      expect(useSessions.getState().sideOpen).toBe(false);
      act(() => useSessions.getState().toggleSide());
      expect(useSessions.getState().sideOpen).toBe(true);
    });

    it('setShowNew updates the flag', () => {
      act(() => useSessions.getState().setShowNew(true));
      expect(useSessions.getState().showNew).toBe(true);
    });
  });

  describe('drafts + turns', () => {
    it('setDraft stores per-session text', () => {
      const a = SEED_OPEN_IDS[0]!;
      const b = SEED_OPEN_IDS[1]!;
      act(() => {
        useSessions.getState().setDraft(a, 'hello');
        useSessions.getState().setDraft(b, 'world');
      });
      const s = useSessions.getState();
      expect(s.drafts[a]).toBe('hello');
      expect(s.drafts[b]).toBe('world');
    });

    it('appendTurn adds to the session and bumps tokens', () => {
      const id = SEED_OPEN_IDS[0]!;
      const before = useSessions.getState().sessions.find((x) => x.id === id)!;
      act(() => {
        useSessions.getState().appendTurn(
          id,
          { id: 't1', role: 'user', blocks: [{ type: 'p', text: 'hi' }], createdAt: Date.now() },
          25,
        );
      });
      const after = useSessions.getState().sessions.find((x) => x.id === id)!;
      expect(after.turns.length).toBe(before.turns.length + 1);
      expect(after.tokens).toBe(before.tokens + 25);
    });

    it('appendTurn accumulates per-category usage when provided', () => {
      const id = SEED_OPEN_IDS[0]!;
      const before = useSessions.getState().sessions.find((x) => x.id === id)!;
      act(() => {
        useSessions.getState().appendTurn(
          id,
          { id: 't-u', role: 'assistant', blocks: [], createdAt: Date.now() },
          150,
          { input: 100, output: 50, cacheCreation: 0, cacheRead: 0 },
        );
      });
      const after = useSessions.getState().sessions.find((x) => x.id === id)!;
      expect(after.usage.input).toBe(before.usage.input + 100);
      expect(after.usage.output).toBe(before.usage.output + 50);
    });
  });

  describe('persistence', () => {
    it('writes the partialized slice to localStorage', () => {
      act(() => useSessions.getState().toggleSide());
      const raw = localStorage.getItem('sessions');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.sideOpen).toBe(false);
      // transient state is not persisted
      expect(parsed.state.renamingId).toBeUndefined();
      expect(parsed.state.showNew).toBeUndefined();
      expect(parsed.state.typing).toBeUndefined();
    });

    it('does NOT persist sessions or turns to localStorage (SQLite owns those)', () => {
      act(() => useSessions.getState().toggleSide());
      const parsed = JSON.parse(localStorage.getItem('sessions') as string);
      expect(parsed.state.sessions).toBeUndefined();
      // openIds + activeId stay in localStorage so tabs paint instantly on launch.
      expect(parsed.state.openIds).toBeDefined();
      expect(parsed.state.activeId).toBeDefined();
    });
  });

  describe('hydrate', () => {
    it('loads sessions from window.api.sessions.list and marks hydrated', async () => {
      const remoteSession = {
        ...SEED_SESSIONS[0]!,
        id: 'remote-1',
        name: 'from-db',
      };
      (window as unknown as { api: unknown }).api = {
        sessions: {
          list: vi.fn().mockResolvedValue([remoteSession]),
          listDeleted: vi.fn().mockResolvedValue([]),
        },
        app: { homeDir: vi.fn().mockResolvedValue('/Users/h') },
      };
      // Start with an unhydrated, empty store so hydrate has work to do.
      useSessions.setState({ sessions: [], openIds: [], activeId: null, hydrated: false, home: '' });

      await act(() => useSessions.getState().hydrate());

      const s = useSessions.getState();
      expect(s.sessions).toEqual([remoteSession]);
      expect(s.hydrated).toBe(true);
      expect(s.home).toBe('/Users/h');
      // Auto-opens the most recent session when nothing was previously open.
      expect(s.openIds).toEqual(['remote-1']);
      expect(s.activeId).toBe('remote-1');

      delete (window as unknown as { api?: unknown }).api;
    });

    it('drops stale openIds + activeId not present in the DB', async () => {
      const remoteSession = { ...SEED_SESSIONS[0]!, id: 'still-here' };
      (window as unknown as { api: unknown }).api = {
        sessions: {
          list: vi.fn().mockResolvedValue([remoteSession]),
          listDeleted: vi.fn().mockResolvedValue([]),
        },
        app: { homeDir: vi.fn().mockResolvedValue('/Users/h') },
      };
      useSessions.setState({
        sessions: [],
        openIds: ['ghost-tab', 'still-here'],
        activeId: 'ghost-tab',
        hydrated: false,
      });

      await act(() => useSessions.getState().hydrate());

      const s = useSessions.getState();
      expect(s.openIds).toEqual(['still-here']);
      expect(s.activeId).toBe('still-here');

      delete (window as unknown as { api?: unknown }).api;
    });
  });

  describe('IPC persistence', () => {
    function installApiMocks() {
      const mocks = {
        create: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        append: vi.fn().mockResolvedValue(undefined),
      };
      (window as unknown as { api: unknown }).api = {
        sessions: {
          list: vi.fn(),
          listDeleted: vi.fn().mockResolvedValue([]),
          create: mocks.create,
          rename: mocks.rename,
          updateSystemPrompt: vi.fn(),
          delete: mocks.delete,
          restore: vi.fn().mockResolvedValue(undefined),
          purge: vi.fn().mockResolvedValue(undefined),
        },
        turns: {
          list: vi.fn(),
          append: mocks.append,
        },
      };
      return mocks;
    }

    afterEach(() => {
      delete (window as unknown as { api?: unknown }).api;
    });

    it('createSession persists via window.api.sessions.create', () => {
      const mocks = installApiMocks();
      act(() => {
        useSessions.getState().createSession({
          name: 'persisted',
          path: '/p',
          model: 'claude-haiku-4-5',
        });
      });
      expect(mocks.create).toHaveBeenCalledTimes(1);
      const arg = mocks.create.mock.calls[0]![0];
      expect(arg).toMatchObject({ name: 'persisted', model: 'claude-haiku-4-5' });
      expect(typeof arg.id).toBe('string');
    });

    it('deleteSession persists via window.api.sessions.delete', () => {
      const mocks = installApiMocks();
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().deleteSession(id));
      expect(mocks.delete).toHaveBeenCalledWith(id);
    });

    it('commitRename persists when a non-empty name is supplied', () => {
      const mocks = installApiMocks();
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().commitRename(id, '  renamed  '));
      expect(mocks.rename).toHaveBeenCalledWith(id, 'renamed');
    });

    it('commitRename does NOT persist when the name is blank', () => {
      const mocks = installApiMocks();
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().commitRename(id, '   '));
      expect(mocks.rename).not.toHaveBeenCalled();
    });

    it('appendTurn persists via window.api.turns.append with token delta', () => {
      const mocks = installApiMocks();
      const id = SEED_OPEN_IDS[0]!;
      const turn = {
        id: 'tx',
        role: 'user' as const,
        blocks: [{ type: 'p' as const, text: 'hi' }],
        createdAt: 123,
      };
      act(() => useSessions.getState().appendTurn(id, turn, 42));
      expect(mocks.append).toHaveBeenCalledWith(id, turn, 42, {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
      });
    });
  });

  /** Pending-terminal-command is the plumbing behind both Sign-in-to-Claude
   *  and Plugin install. Easy to break by accident, so cover the contract:
   *  strings normalise to a one-step array, explicit step arrays are stored
   *  verbatim, and consume clears the slot. */
  describe('pendingTerminalCommands', () => {
    beforeEach(() => {
      useSessions.setState({ pendingTerminalCommands: {} });
    });

    it('normalises a string into a one-step array', () => {
      useSessions.getState().setPendingTerminalCommand('sess-1', 'claude\r');
      const steps = useSessions
        .getState()
        .consumePendingTerminalCommand('sess-1');
      expect(steps).toEqual([{ text: 'claude\r' }]);
    });

    it('stores an explicit step array verbatim — the Sign-in two-step sequence', () => {
      const queue = [
        { text: 'claude\r', delayMs: 250 },
        { text: '/login\r', delayMs: 2000 },
      ];
      useSessions.getState().setPendingTerminalCommand('sess-2', queue);
      expect(
        useSessions.getState().consumePendingTerminalCommand('sess-2'),
      ).toEqual(queue);
    });

    it('clears the slot after consume', () => {
      useSessions.getState().setPendingTerminalCommand('sess-3', 'foo\r');
      useSessions.getState().consumePendingTerminalCommand('sess-3');
      expect(
        useSessions.getState().consumePendingTerminalCommand('sess-3'),
      ).toBeUndefined();
    });

    it('returns undefined for sessions with no pending steps', () => {
      expect(
        useSessions.getState().consumePendingTerminalCommand('sess-none'),
      ).toBeUndefined();
    });
  });
});
