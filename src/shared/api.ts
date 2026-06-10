/**
 * Typed IPC surface exposed on `window.api`.
 *
 * Implemented progressively across the milestones. Each method maps to an
 * `ipcMain.handle()` in the main process.
 */

import type { Block, Session, SessionId, Turn } from './types';

export type ModelFamily = 'opus' | 'sonnet' | 'haiku';
/** A specific model ID the API exposes, e.g. 'claude-sonnet-4-6'. */
export type ModelId = string;

/** Subset of `NodeJS.Platform` re-declared in plain TS so the renderer doesn't need @types/node. */
export type Platform = 'darwin' | 'win32' | 'linux' | 'freebsd' | 'openbsd' | 'sunos' | 'aix';

export type Unsubscribe = () => void;

export interface CreateSessionInput {
  /** Caller-supplied id (renderer-generated UUID) so optimistic UI keeps the same id end-to-end. */
  id: string;
  name: string;
  path: string;
  model: ModelId;
  systemPrompt?: string;
  branch?: string;
  createdAt?: number;
}

/** Events streamed back from `api.chat.send()`. */
export type ChatEvent =
  | { type: 'turn-start'; turnId: string; modelShort?: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; toolId: string; name: string; input: unknown }
  | { type: 'tool-result'; toolId: string; content: string; isError?: boolean }
  | {
      type: 'turn-stop';
      turnId: string;
      blocks: Block[];
      addTokens: number;
      sdkSessionId: string;
    }
  | { type: 'error'; message: string };

export interface Api {
  app: {
    /** Smoke test — returns 'pong' from main. Used to verify the IPC wiring. */
    ping(): Promise<'pong'>;
    /** Host platform — the renderer uses this to draw traffic lights vs. min/max/close. */
    platform(): Promise<Platform>;
    /** Ask the main process to close the focused BrowserWindow. */
    closeWindow(): Promise<void>;
    /** User's home directory, used to tilde-collapse paths for display. */
    homeDir(): Promise<string>;
    /**
     * Subscribe to "user pressed Cmd+W" (or the platform equivalent), fired
     * by the application menu. Renderer decides what to do — close an active
     * tab if any, otherwise fall back to `closeWindow()`.
     */
    onRequestCloseTab(handler: () => void): Unsubscribe;
  };
  fs: {
    /** Native OS folder picker. Resolves to the picked absolute path, or null if cancelled. */
    pickDirectory(): Promise<string | null>;
    /** Reads `.git/HEAD` for `path`. Returns the branch name, short SHA for detached HEAD, or ''. */
    branchFor(path: string): Promise<string>;
    /** True if `path` is an existing, readable directory. */
    isReadableDir(path: string): Promise<boolean>;
  };
  chat: {
    /** Begin a streaming chat turn. The promise resolves on `turn-stop`. */
    send(sessionId: SessionId, userText: string): Promise<void>;
    /** Subscribe to chat events for *all* sessions; filter by `sessionId` inside handler. */
    onEvent(
      handler: (sessionId: SessionId, event: ChatEvent) => void,
    ): Unsubscribe;
  };
  sessions: {
    /** Active (non-deleted) sessions with their turns embedded, ordered by most-recently-active. */
    list(): Promise<Session[]>;
    /** Soft-deleted sessions, most recently deleted first. */
    listDeleted(): Promise<Session[]>;
    create(input: CreateSessionInput): Promise<Session>;
    rename(id: SessionId, name: string): Promise<void>;
    updateSystemPrompt(id: SessionId, systemPrompt: string): Promise<void>;
    /** Soft-delete: moves the session to the history list. Turns are preserved. */
    delete(id: SessionId): Promise<void>;
    /** Restore a previously soft-deleted session back to active. */
    restore(id: SessionId): Promise<void>;
  };
  turns: {
    list(sessionId: SessionId): Promise<Turn[]>;
    append(sessionId: SessionId, turn: Turn, addTokens?: number): Promise<void>;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}
