import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Session, Turn } from '@shared/types';
import { openSessionsDb, type SessionsDb } from './db';

function turn(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  createdAt = 1_000_000,
  modelShort?: string,
): Turn {
  const t: Turn = {
    id,
    role,
    blocks: [{ type: 'p', text }],
    createdAt,
  };
  if (modelShort) t.modelShort = modelShort;
  return t;
}

function seedSession(id = 'sess-1', name = 'demo'): Session {
  return {
    id,
    name,
    path: '~/dev/demo',
    model: 'claude-sonnet-4-6',
    systemPrompt: '',
    branch: 'main',
    createdAt: 1_000_000,
    lastActiveAt: 1_000_000,
    tokens: 0,
    usage: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
    sdkSessionId: '',
    turns: [],
  };
}

describe('SessionsDb', () => {
  let db: SessionsDb;

  beforeEach(() => {
    db = openSessionsDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('schema', () => {
    it('starts empty', () => {
      expect(db.listSessions()).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('inserts a session with the supplied id and returns it shaped as a Session', () => {
      const s = db.createSession({
        id: 'sess-1',
        name: 'demo',
        path: '~/dev/demo',
        model: 'claude-sonnet-4-6',
        systemPrompt: 'be terse',
        branch: 'main',
        createdAt: 1_700_000_000_000,
        tokens: 0,
      });
      expect(s).toMatchObject({
        id: 'sess-1',
        name: 'demo',
        systemPrompt: 'be terse',
        branch: 'main',
        createdAt: 1_700_000_000_000,
        lastActiveAt: 1_700_000_000_000,
        turns: [],
      });
      expect(db.listSessions()).toHaveLength(1);
    });

    it('defaults branch, systemPrompt, tokens, and createdAt when omitted', () => {
      const before = Date.now();
      const s = db.createSession({
        id: 'sess-2',
        name: 'minimal',
        path: '~/dev/x',
        model: 'claude-haiku-4-5',
      });
      expect(s.branch).toBe('');
      expect(s.systemPrompt).toBe('');
      expect(s.tokens).toBe(0);
      expect(s.createdAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('listSessions', () => {
    it('orders sessions by last_active DESC', () => {
      db.createSession({
        id: 'old',
        name: 'old',
        path: '/x',
        model: 'm',
        createdAt: 100,
      });
      db.createSession({
        id: 'new',
        name: 'new',
        path: '/y',
        model: 'm',
        createdAt: 500,
      });
      const list = db.listSessions();
      expect(list.map((s) => s.id)).toEqual(['new', 'old']);
    });

    it('embeds turns in chronological order', () => {
      db.createSession({ id: 's', name: 'n', path: '/p', model: 'm', createdAt: 1 });
      db.appendTurn('s', turn('t2', 'assistant', 'second', 200));
      db.appendTurn('s', turn('t1', 'user', 'first', 100));
      const [s] = db.listSessions();
      expect(s!.turns.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(s!.turns[0]!.blocks).toEqual([{ type: 'p', text: 'first' }]);
    });
  });

  describe('updates', () => {
    beforeEach(() => {
      db.createSession({ id: 's', name: 'n', path: '/p', model: 'm', createdAt: 1 });
    });

    it('renameSession changes the name', () => {
      db.renameSession('s', 'renamed');
      expect(db.listSessions()[0]!.name).toBe('renamed');
    });

    it('updateSystemPrompt persists the prompt', () => {
      db.updateSystemPrompt('s', 'be excellent');
      expect(db.listSessions()[0]!.systemPrompt).toBe('be excellent');
    });

    it('updateModel changes the model id', () => {
      db.updateModel('s', 'claude-opus-4-7');
      expect(db.listSessions()[0]!.model).toBe('claude-opus-4-7');
    });

    it('updateBranch changes the branch', () => {
      db.updateBranch('s', 'feat/x');
      expect(db.listSessions()[0]!.branch).toBe('feat/x');
    });
  });

  describe('appendTurn', () => {
    beforeEach(() => {
      db.createSession({ id: 's', name: 'n', path: '/p', model: 'm', createdAt: 1 });
    });

    it('persists role, blocks JSON, model_short, and createdAt', () => {
      db.appendTurn('s', turn('t1', 'assistant', 'reply', 200, 'Sonnet'), 0);
      const [t] = db.listTurns('s');
      expect(t).toMatchObject({
        id: 't1',
        role: 'assistant',
        modelShort: 'Sonnet',
        createdAt: 200,
      });
      expect(t!.blocks).toEqual([{ type: 'p', text: 'reply' }]);
    });

    it('round-trips complex Block variants through JSON', () => {
      const t: Turn = {
        id: 't1',
        role: 'assistant',
        createdAt: 300,
        blocks: [
          { type: 'h', text: 'heading' },
          { type: 'ul', items: ['a', 'b'] },
          { type: 'code', lang: 'ts', code: 'const x = 1;' },
          {
            type: 'win',
            kind: 'edit',
            path: 'src/x.ts',
            tag: '+1 -0',
            diff: '+const y = 2;',
          },
          { type: 'error', message: 'boom' },
        ],
      };
      db.appendTurn('s', t);
      const round = db.listTurns('s')[0]!;
      expect(round.blocks).toEqual(t.blocks);
    });

    it('bumps the session tokens and last_active atomically', () => {
      db.appendTurn('s', turn('t1', 'user', 'hi', 100), 25);
      db.appendTurn('s', turn('t2', 'assistant', 'hi back', 200), 75);
      const s = db.listSessions()[0]!;
      expect(s.tokens).toBe(100);
      expect(s.lastActiveAt).toBe(200);
    });

    it('accumulates per-category usage across turns', () => {
      db.appendTurn('s', turn('t1', 'user', 'hi', 100), 50, {
        input: 30,
        output: 20,
        cacheCreation: 0,
        cacheRead: 0,
      });
      db.appendTurn('s', turn('t2', 'assistant', 'hi back', 200), 80, {
        input: 10,
        output: 40,
        cacheCreation: 5,
        cacheRead: 25,
      });
      const s = db.listSessions()[0]!;
      expect(s.tokens).toBe(130);
      expect(s.usage).toEqual({
        input: 40,
        output: 60,
        cacheCreation: 5,
        cacheRead: 25,
      });
    });

    it('treats missing addUsage as zero so legacy callers still work', () => {
      db.appendTurn('s', turn('t1', 'user', 'hi', 100), 17);
      const s = db.listSessions()[0]!;
      expect(s.tokens).toBe(17);
      expect(s.usage).toEqual({
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
      });
    });

    it('omits modelShort from the returned Turn when stored as null', () => {
      db.appendTurn('s', turn('t1', 'user', 'hi', 100));
      const [t] = db.listTurns('s');
      expect('modelShort' in t!).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('cascades delete to dependent turns', () => {
      db.createSession({ id: 's', name: 'n', path: '/p', model: 'm', createdAt: 1 });
      db.appendTurn('s', turn('t1', 'user', 'hi'));
      db.appendTurn('s', turn('t2', 'assistant', 'hello'));
      expect(db.listTurns('s')).toHaveLength(2);

      db.deleteSession('s');
      expect(db.listSessions()).toEqual([]);
      expect(db.listTurns('s')).toEqual([]);
    });
  });

  describe('purgeAllDeleted', () => {
    it('removes every soft-deleted session and reports the count', () => {
      db.createSession({ id: 'a', name: 'A', path: '/a', model: 'm', createdAt: 1 });
      db.createSession({ id: 'b', name: 'B', path: '/b', model: 'm', createdAt: 2 });
      db.createSession({ id: 'c', name: 'C', path: '/c', model: 'm', createdAt: 3 });
      db.appendTurn('a', turn('ta', 'user', 'hi'));
      db.appendTurn('b', turn('tb', 'user', 'hi'));
      db.softDeleteSession('a');
      db.softDeleteSession('b');
      expect(db.listDeletedSessions()).toHaveLength(2);

      expect(db.purgeAllDeleted()).toBe(2);
      expect(db.listDeletedSessions()).toEqual([]);
      // Active session 'c' is untouched.
      expect(db.listSessions().map((s) => s.id)).toEqual(['c']);
      // Cascaded turns are gone too.
      expect(db.listTurns('a')).toEqual([]);
      expect(db.listTurns('b')).toEqual([]);
    });

    it('is a no-op when there is nothing soft-deleted', () => {
      db.createSession({ id: 'live', name: 'L', path: '/l', model: 'm', createdAt: 1 });
      expect(db.purgeAllDeleted()).toBe(0);
      expect(db.listSessions().map((s) => s.id)).toEqual(['live']);
    });
  });
});

