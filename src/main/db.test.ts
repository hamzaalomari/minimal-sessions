import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Session, Turn } from '@shared/types';
import { openSessionsDb, seedIfEmpty, type SessionsDb } from './db';

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
});

describe('seedIfEmpty', () => {
  let db: SessionsDb;

  beforeEach(() => {
    db = openSessionsDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('inserts seeds and their turns when the DB is empty', () => {
    const seed: Session = {
      ...seedSession('s1'),
      turns: [turn('t1', 'user', 'q', 100), turn('t2', 'assistant', 'a', 200, 'Sonnet')],
    };
    const ran = seedIfEmpty(db, [seed]);
    expect(ran).toBe(true);
    const list = db.listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]!.turns).toHaveLength(2);
    expect(list[0]!.turns[1]!.modelShort).toBe('Sonnet');
  });

  it('is a no-op when the DB already has sessions', () => {
    db.createSession({ id: 'existing', name: 'x', path: '/x', model: 'm', createdAt: 1 });
    const ran = seedIfEmpty(db, [seedSession('s1')]);
    expect(ran).toBe(false);
    expect(db.listSessions().map((s) => s.id)).toEqual(['existing']);
  });

  it('does nothing when the seed list is empty', () => {
    const ran = seedIfEmpty(db, []);
    expect(ran).toBe(false);
    expect(db.listSessions()).toEqual([]);
  });
});
