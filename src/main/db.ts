import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import type { Block, Session, SessionId, TokenUsage, Turn } from '@shared/types';

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
  tokens_input    INTEGER NOT NULL DEFAULT 0,
  tokens_output   INTEGER NOT NULL DEFAULT 0,
  tokens_cache_w  INTEGER NOT NULL DEFAULT 0,
  tokens_cache_r  INTEGER NOT NULL DEFAULT 0,
  sdk_session_id  TEXT NOT NULL DEFAULT '',
  deleted_at      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS turns (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  blocks_json    TEXT NOT NULL,
  model_short    TEXT,
  created_at     INTEGER NOT NULL,
  tokens_input   INTEGER NOT NULL DEFAULT 0,
  tokens_output  INTEGER NOT NULL DEFAULT 0,
  tokens_cache_w INTEGER NOT NULL DEFAULT 0,
  tokens_cache_r INTEGER NOT NULL DEFAULT 0
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
  tokens_input: number;
  tokens_output: number;
  tokens_cache_w: number;
  tokens_cache_r: number;
  sdk_session_id: string;
}

interface TurnRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  blocks_json: string;
  model_short: string | null;
  created_at: number;
  tokens_input: number;
  tokens_output: number;
  tokens_cache_w: number;
  tokens_cache_r: number;
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
  /** Permanently delete every soft-deleted session in one statement. Used
   *  by the "Delete all" button in the History view. Returns the count of
   *  rows removed so callers can update local state without re-fetching. */
  purgeAllDeleted(): number;
  /** Turns for a single session, ordered by creation time. */
  listTurns(sessionId: SessionId): Turn[];
  /** Append a turn AND atomically bump the session's tokens + usage + last_active. */
  appendTurn(
    sessionId: SessionId,
    turn: Turn,
    addTokens?: number,
    addUsage?: TokenUsage,
  ): void;
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
    usage: {
      input: row.tokens_input ?? 0,
      output: row.tokens_output ?? 0,
      cacheCreation: row.tokens_cache_w ?? 0,
      cacheRead: row.tokens_cache_r ?? 0,
    },
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
  // Only attach usage when at least one category is non-zero — legacy rows
  // pre-migration default to all-zeros and would otherwise pollute the
  // time-filtered analytics view.
  const ti = row.tokens_input ?? 0;
  const to = row.tokens_output ?? 0;
  const tw = row.tokens_cache_w ?? 0;
  const tr = row.tokens_cache_r ?? 0;
  if (ti || to || tw || tr) {
    turn.usage = { input: ti, output: to, cacheCreation: tw, cacheRead: tr };
  }
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
  purgeAllDeleted: Statement<[]>;
  listTurnsForSession: Statement<[string], TurnRow>;
  listAllTurns: Statement<[], TurnRow>;
  insertTurn: Statement<[
    string, string, 'user' | 'assistant', string, string | null, number,
    number, number, number, number,
  ]>;
  bumpTokensAndTouch: Statement<[
    number, number, number, number, number, number, string,
  ]>;
  countSessions: Statement<[], { n: number }>;
}

export function openSessionsDb(filename: string): SessionsDb {
  const db: DatabaseType = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // Idempotent migrations for tables created before these columns existed.
  const cols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
  }>;
  const has = (name: string): boolean => cols.some((c) => c.name === name);
  if (!has('sdk_session_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT NOT NULL DEFAULT ''");
  }
  if (!has('deleted_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0');
  }
  if (!has('tokens_input')) {
    db.exec('ALTER TABLE sessions ADD COLUMN tokens_input INTEGER NOT NULL DEFAULT 0');
  }
  if (!has('tokens_output')) {
    db.exec('ALTER TABLE sessions ADD COLUMN tokens_output INTEGER NOT NULL DEFAULT 0');
  }
  if (!has('tokens_cache_w')) {
    db.exec('ALTER TABLE sessions ADD COLUMN tokens_cache_w INTEGER NOT NULL DEFAULT 0');
  }
  if (!has('tokens_cache_r')) {
    db.exec('ALTER TABLE sessions ADD COLUMN tokens_cache_r INTEGER NOT NULL DEFAULT 0');
  }
  // Per-turn usage columns — added so the analytics view can date-filter.
  const turnCols = db.prepare('PRAGMA table_info(turns)').all() as Array<{
    name: string;
  }>;
  const turnHas = (name: string): boolean => turnCols.some((c) => c.name === name);
  if (!turnHas('tokens_input')) {
    db.exec('ALTER TABLE turns ADD COLUMN tokens_input INTEGER NOT NULL DEFAULT 0');
  }
  if (!turnHas('tokens_output')) {
    db.exec('ALTER TABLE turns ADD COLUMN tokens_output INTEGER NOT NULL DEFAULT 0');
  }
  if (!turnHas('tokens_cache_w')) {
    db.exec('ALTER TABLE turns ADD COLUMN tokens_cache_w INTEGER NOT NULL DEFAULT 0');
  }
  if (!turnHas('tokens_cache_r')) {
    db.exec('ALTER TABLE turns ADD COLUMN tokens_cache_r INTEGER NOT NULL DEFAULT 0');
  }

  // Earlier builds (<=0.1.3) seeded three demo sessions on first launch. The
  // seeded rows all use IDs prefixed `seed-` — drop them on startup so users
  // upgrading from those builds get a clean list. FK cascade clears turns.
  db.exec("DELETE FROM sessions WHERE id LIKE 'seed-%'");

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
    // Hard-delete every soft-deleted row. Turns cascade (ON DELETE CASCADE on
    // turns.session_id), so this single statement also wipes their messages.
    purgeAllDeleted: db.prepare('DELETE FROM sessions WHERE deleted_at != 0'),
    listTurnsForSession: db.prepare(
      'SELECT * FROM turns WHERE session_id = ? ORDER BY created_at ASC, id ASC',
    ) as Statement<[string], TurnRow>,
    listAllTurns: db.prepare(
      'SELECT * FROM turns ORDER BY session_id, created_at ASC, id ASC',
    ) as Statement<[], TurnRow>,
    insertTurn: db.prepare(
      `INSERT INTO turns
         (id, session_id, role, blocks_json, model_short, created_at,
          tokens_input, tokens_output, tokens_cache_w, tokens_cache_r)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    bumpTokensAndTouch: db.prepare(
      `UPDATE sessions
         SET tokens         = tokens + ?,
             tokens_input   = tokens_input + ?,
             tokens_output  = tokens_output + ?,
             tokens_cache_w = tokens_cache_w + ?,
             tokens_cache_r = tokens_cache_r + ?,
             last_active    = ?
       WHERE id = ?`,
    ),
    countSessions: db.prepare('SELECT COUNT(*) AS n FROM sessions') as Statement<
      [],
      { n: number }
    >,
  };

  const appendTurnTx = db.transaction(
    (sessionId: string, turn: Turn, addTokens: number, addUsage: TokenUsage) => {
      stmts.insertTurn.run(
        turn.id,
        sessionId,
        turn.role,
        JSON.stringify(turn.blocks),
        turn.modelShort ?? null,
        turn.createdAt,
        addUsage.input,
        addUsage.output,
        addUsage.cacheCreation,
        addUsage.cacheRead,
      );
      stmts.bumpTokensAndTouch.run(
        addTokens,
        addUsage.input,
        addUsage.output,
        addUsage.cacheCreation,
        addUsage.cacheRead,
        turn.createdAt,
        sessionId,
      );
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
        usage: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
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
    purgeAllDeleted() {
      const info = stmts.purgeAllDeleted.run();
      return info.changes;
    },
    listTurns(sessionId) {
      return stmts.listTurnsForSession.all(sessionId).map(rowToTurn);
    },
    appendTurn(sessionId, turn, addTokens = 0, addUsage) {
      const usage: TokenUsage = addUsage ?? {
        input: 0,
        output: 0,
        cacheCreation: 0,
        cacheRead: 0,
      };
      appendTurnTx(sessionId, turn, addTokens, usage);
    },
    close() {
      db.close();
    },
  };
}

