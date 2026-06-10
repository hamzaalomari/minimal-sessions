import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import type { Block, Session, SessionId, Turn } from '@shared/types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,
  model           TEXT NOT NULL,
  system_prompt   TEXT NOT NULL DEFAULT '',
  branch          TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  last_active     INTEGER NOT NULL,
  tokens          INTEGER NOT NULL DEFAULT 0,
  sdk_session_id  TEXT NOT NULL DEFAULT '',
  deleted_at      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS turns (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  model_short TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS turns_session_order ON turns (session_id, created_at);
`;

interface SessionRow {
  id: string;
  name: string;
  path: string;
  model: string;
  system_prompt: string;
  branch: string;
  created_at: number;
  last_active: number;
  tokens: number;
  sdk_session_id: string;
}

interface TurnRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  blocks_json: string;
  model_short: string | null;
  created_at: number;
}

export interface CreateSessionInput {
  id: string;
  name: string;
  path: string;
  model: string;
  systemPrompt?: string;
  branch?: string;
  createdAt?: number;
  tokens?: number;
}

export interface SessionsDb {
  /** Active sessions with their turns embedded (eager join). */
  listSessions(): Session[];
  /** Soft-deleted sessions, most recently deleted first. */
  listDeletedSessions(): Session[];
  createSession(input: CreateSessionInput): Session;
  renameSession(id: SessionId, name: string): void;
  updateSystemPrompt(id: SessionId, systemPrompt: string): void;
  updateModel(id: SessionId, model: string): void;
  updateBranch(id: SessionId, branch: string): void;
  updateSdkSessionId(id: SessionId, sdkSessionId: string): void;
  /** Soft delete — sets deleted_at; turns are preserved. */
  softDeleteSession(id: SessionId): void;
  /** Restore a soft-deleted session to active state. */
  restoreSession(id: SessionId): void;
  /** Hard delete — cascades to turns. */
  deleteSession(id: SessionId): void;
  /** Turns for a single session, ordered by creation time. */
  listTurns(sessionId: SessionId): Turn[];
  /** Append a turn AND atomically bump the session's tokens + last_active. */
  appendTurn(sessionId: SessionId, turn: Turn, addTokens?: number): void;
  close(): void;
}

function rowToSession(row: SessionRow, turns: Turn[]): Session {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    model: row.model,
    systemPrompt: row.system_prompt,
    branch: row.branch,
    createdAt: row.created_at,
    lastActiveAt: row.last_active,
    tokens: row.tokens,
    sdkSessionId: row.sdk_session_id ?? '',
    turns,
  };
}

function rowToTurn(row: TurnRow): Turn {
  const turn: Turn = {
    id: row.id,
    role: row.role,
    blocks: JSON.parse(row.blocks_json) as Block[],
    createdAt: row.created_at,
  };
  if (row.model_short) turn.modelShort = row.model_short;
  return turn;
}

interface Statements {
  listSessions: Statement<[], SessionRow>;
  insertSession: Statement<[
    string, string, string, string, string, string, number, number, number,
  ]>;
  renameSession: Statement<[string, string]>;
  updateSystemPrompt: Statement<[string, string]>;
  updateModel: Statement<[string, string]>;
  updateBranch: Statement<[string, string]>;
  updateSdkSessionId: Statement<[string, string]>;
  softDeleteSession: Statement<[number, string]>;
  restoreSession: Statement<[string]>;
  listDeletedSessions: Statement<[], SessionRow>;
  deleteSession: Statement<[string]>;
  listTurnsForSession: Statement<[string], TurnRow>;
  listAllTurns: Statement<[], TurnRow>;
  insertTurn: Statement<[string, string, 'user' | 'assistant', string, string | null, number]>;
  bumpTokensAndTouch: Statement<[number, number, string]>;
  countSessions: Statement<[], { n: number }>;
}

export function openSessionsDb(filename: string): SessionsDb {
  const db: DatabaseType = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // Idempotent migrations for tables created before this column existed.
  const cols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
  }>;
  if (!cols.some((c) => c.name === 'sdk_session_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0');
  }

  const stmts: Statements = {
    listSessions: db.prepare(
      'SELECT * FROM sessions WHERE deleted_at = 0 ORDER BY last_active DESC',
    ) as Statement<[], SessionRow>,
    listDeletedSessions: db.prepare(
      'SELECT * FROM sessions WHERE deleted_at != 0 ORDER BY deleted_at DESC',
    ) as Statement<[], SessionRow>,
    insertSession: db.prepare(
      `INSERT INTO sessions
         (id, name, path, model, system_prompt, branch, created_at, last_active, tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    renameSession: db.prepare('UPDATE sessions SET name = ? WHERE id = ?'),
    updateSystemPrompt: db.prepare(
      'UPDATE sessions SET system_prompt = ? WHERE id = ?',
    ),
    updateModel: db.prepare('UPDATE sessions SET model = ? WHERE id = ?'),
    updateBranch: db.prepare('UPDATE sessions SET branch = ? WHERE id = ?'),
    updateSdkSessionId: db.prepare(
      'UPDATE sessions SET sdk_session_id = ? WHERE id = ?',
    ),
    softDeleteSession: db.prepare(
      'UPDATE sessions SET deleted_at = ? WHERE id = ?',
    ),
    restoreSession: db.prepare(
      'UPDATE sessions SET deleted_at = 0 WHERE id = ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    listTurnsForSession: db.prepare(
      'SELECT * FROM turns WHERE session_id = ? ORDER BY created_at ASC, id ASC',
    ) as Statement<[string], TurnRow>,
    listAllTurns: db.prepare(
      'SELECT * FROM turns ORDER BY session_id, created_at ASC, id ASC',
    ) as Statement<[], TurnRow>,
    insertTurn: db.prepare(
      `INSERT INTO turns (id, session_id, role, blocks_json, model_short, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    bumpTokensAndTouch: db.prepare(
      'UPDATE sessions SET tokens = tokens + ?, last_active = ? WHERE id = ?',
    ),
    countSessions: db.prepare('SELECT COUNT(*) AS n FROM sessions') as Statement<
      [],
      { n: number }
    >,
  };

  const appendTurnTx = db.transaction(
    (sessionId: string, turn: Turn, addTokens: number) => {
      stmts.insertTurn.run(
        turn.id,
        sessionId,
        turn.role,
        JSON.stringify(turn.blocks),
        turn.modelShort ?? null,
        turn.createdAt,
      );
      stmts.bumpTokensAndTouch.run(addTokens, turn.createdAt, sessionId);
    },
  );

  function hydrateRows(rows: SessionRow[]): Session[] {
    if (rows.length === 0) return [];
    const turnsBySession = new Map<string, Turn[]>();
    for (const t of stmts.listAllTurns.all()) {
      const arr = turnsBySession.get(t.session_id);
      const turn = rowToTurn(t);
      if (arr) arr.push(turn);
      else turnsBySession.set(t.session_id, [turn]);
    }
    return rows.map((r) => rowToSession(r, turnsBySession.get(r.id) ?? []));
  }

  function listSessions(): Session[] {
    return hydrateRows(stmts.listSessions.all());
  }

  function listDeletedSessions(): Session[] {
    return hydrateRows(stmts.listDeletedSessions.all());
  }

  return {
    listSessions,
    listDeletedSessions,
    createSession(input) {
      const now = input.createdAt ?? Date.now();
      const branch = input.branch ?? '';
      const systemPrompt = input.systemPrompt ?? '';
      const tokens = input.tokens ?? 0;
      stmts.insertSession.run(
        input.id,
        input.name,
        input.path,
        input.model,
        systemPrompt,
        branch,
        now,
        now,
        tokens,
      );
      return {
        id: input.id,
        name: input.name,
        path: input.path,
        model: input.model,
        systemPrompt,
        branch,
        createdAt: now,
        lastActiveAt: now,
        tokens,
        sdkSessionId: '',
        turns: [],
      };
    },
    renameSession(id, name) {
      stmts.renameSession.run(name, id);
    },
    updateSystemPrompt(id, systemPrompt) {
      stmts.updateSystemPrompt.run(systemPrompt, id);
    },
    updateModel(id, model) {
      stmts.updateModel.run(model, id);
    },
    updateBranch(id, branch) {
      stmts.updateBranch.run(branch, id);
    },
    updateSdkSessionId(id, sdkSessionId) {
      stmts.updateSdkSessionId.run(sdkSessionId, id);
    },
    softDeleteSession(id) {
      stmts.softDeleteSession.run(Date.now(), id);
    },
    restoreSession(id) {
      stmts.restoreSession.run(id);
    },
    deleteSession(id) {
      stmts.deleteSession.run(id);
    },
    listTurns(sessionId) {
      return stmts.listTurnsForSession.all(sessionId).map(rowToTurn);
    },
    appendTurn(sessionId, turn, addTokens = 0) {
      appendTurnTx(sessionId, turn, addTokens);
    },
    close() {
      db.close();
    },
  };
}

/**
 * Seed an empty DB with starter sessions. No-op if any session exists.
 * Returns true if seeding ran.
 */
export function seedIfEmpty(db: SessionsDb, seeds: Session[]): boolean {
  if (seeds.length === 0) return false;
  const existing = db.listSessions();
  if (existing.length > 0) return false;
  for (const s of seeds) {
    db.createSession({
      id: s.id,
      name: s.name,
      path: s.path,
      model: s.model,
      systemPrompt: s.systemPrompt,
      branch: s.branch,
      createdAt: s.createdAt,
      tokens: s.tokens,
    });
    for (const t of s.turns) {
      db.appendTurn(s.id, t, 0);
    }
  }
  return true;
}
