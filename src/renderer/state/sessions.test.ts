import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '../data/seed';
import { useSessions } from './sessions';

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

  describe('deleteSession', () => {
    it('drops the session, its tab, and its draft', () => {
      const id = SEED_OPEN_IDS[0]!;
      act(() => useSessions.getState().setDraft(id, 'hi'));
      act(() => useSessions.getState().deleteSession(id));
      const s = useSessions.getState();
      expect(s.sessions.find((x) => x.id === id)).toBeUndefined();
      expect(s.openIds).not.toContain(id);
      expect(s.drafts[id]).toBeUndefined();
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
  });
});
