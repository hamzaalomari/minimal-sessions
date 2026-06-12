/**
 * Typed IPC surface exposed on `window.api`.
 *
 * Implemented progressively across the milestones. Each method maps to an
 * `ipcMain.handle()` in the main process.
 */

import type { Block, Session, SessionId, TokenUsage, Turn } from './types';

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

/** A model entry returned by `api.models.list()`. */
export interface SdkModel {
  id: string;
  displayName: string;
  description: string;
}

/** A discoverable slash command — returned by `api.commands.list()`. Plugin
 *  commands are namespaced as `pluginName:cmdName` matching the SDK's
 *  invocation format. */
export interface SlashCommand {
  name: string;
  description?: string;
  scope: 'project' | 'user' | 'plugin' | 'builtin';
}

/** An Agent SDK skill the renderer can surface in the "Loaded skills" list.
 *  Skills are autonomously invoked by the SDK when relevant — we don't list
 *  them in autocomplete, just show users what's currently armed. */
export interface SkillInfo {
  name: string;
  description?: string;
  scope: 'project' | 'user' | 'plugin' | 'builtin';
}

/** Branch / worktree options for the New Session panel — sent to the main
 *  process before the session is created so git side-effects happen up-front. */
export interface GitInitSessionInput {
  path: string;
  mode: 'none' | 'branch' | 'worktree';
  name?: string;
}

/** Resolved path + branch the new session should open against. */
export interface GitInitSessionResult {
  path: string;
  branch: string;
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
      addUsage: TokenUsage;
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
    /** Cmd/Ctrl+N — open the new-session panel. */
    onRequestNewSession(handler: () => void): Unsubscribe;
    /** Cmd/Ctrl+\\ — collapse/expand the sidebar. */
    onRequestToggleSidebar(handler: () => void): Unsubscribe;
    /** Cmd/Ctrl+, — open the settings popover. */
    onRequestOpenSettings(handler: () => void): Unsubscribe;
    /** Cmd/Ctrl+F — switch the sidebar to the Search view and focus the input. */
    onRequestOpenSearch(handler: () => void): Unsubscribe;
    /** Cmd/Ctrl+J — toggle the embedded terminal panel for the active session. */
    onRequestToggleTerminal(handler: () => void): Unsubscribe;
    /** Cmd/Ctrl+1..9 — focus the Nth open tab. Handler is a no-op when out of range. */
    onRequestSelectTab(handler: (n: number) => void): Unsubscribe;
    /** Mouse-button-4 / Cmd/Ctrl+Alt+Left — pop the previous nav state. */
    onRequestNavigateBack(handler: () => void): Unsubscribe;
    /** Mouse-button-5 / Cmd/Ctrl+Alt+Right — re-push a popped nav state. */
    onRequestNavigateForward(handler: () => void): Unsubscribe;
    /** Ctrl+Tab / CmdOrCtrl+~ / CmdOrCtrl+PageDown / CmdOrCtrl+Shift+] —
     *  cycle forward through open tabs in tab order, wrapping at the end. */
    onRequestNextTab(handler: () => void): Unsubscribe;
    /** Ctrl+Shift+Tab / CmdOrCtrl+PageUp / CmdOrCtrl+Shift+[ — cycle
     *  backward through open tabs, wrapping at the start. */
    onRequestPrevTab(handler: () => void): Unsubscribe;
  };
  fs: {
    /** Native OS folder picker. Resolves to the picked absolute path, or null if cancelled. */
    pickDirectory(): Promise<string | null>;
    /** Reads `.git/HEAD` for `path`. Returns the branch name, short SHA for detached HEAD, or ''. */
    branchFor(path: string): Promise<string>;
    /** True if `path` is an existing, readable directory. */
    isReadableDir(path: string): Promise<boolean>;
    /** Run the git side-effect the user picked in the New Session panel — none
     *  (no-op), branch (switch -c), or worktree (worktree add -b). Returns the
     *  resolved path + branch the session should open against. Throws with a
     *  human-readable message on failure. */
    gitInitSession(input: GitInitSessionInput): Promise<GitInitSessionResult>;
  };
  models: {
    /** All models the locally-installed Claude SDK advertises. Cached per session. */
    list(): Promise<SdkModel[]>;
  };
  commands: {
    /** Slash commands available for the session at `cwd`. Includes standalone
     *  files (~/.claude/commands, project commands) and plugin-bundled commands
     *  (namespaced `pluginName:cmdName`). Cached in main for ~30s. */
    list(cwd: string): Promise<SlashCommand[]>;
  };
  skills: {
    /** Agent SDK skills available for the session at `cwd`. Read-only listing
     *  for the UI — the SDK invokes them autonomously based on the
     *  conversation. Cached in main for ~30s. */
    list(cwd: string): Promise<SkillInfo[]>;
  };
  chat: {
    /**
     * Begin a streaming chat turn. The promise resolves on `turn-stop`.
     * `globalSystemPrompt` is prepended to the session's own `systemPrompt`
     * when calling the SDK; pass `''` to opt out.
     */
    send(
      sessionId: SessionId,
      userText: string,
      globalSystemPrompt?: string,
    ): Promise<void>;
    /**
     * Cancel the in-flight turn for this session. No-op if nothing is streaming.
     * Analog of pressing Esc in the Claude CLI.
     */
    stop(sessionId: SessionId): Promise<void>;
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
    /** Permanently delete a session and its turns. Used from the History view. */
    purge(id: SessionId): Promise<void>;
    /** Permanently delete every soft-deleted session in one DB statement —
     *  cascades to their turns. Returns the count of removed sessions. */
    purgeAllDeleted(): Promise<number>;
  };
  turns: {
    list(sessionId: SessionId): Promise<Turn[]>;
    append(
      sessionId: SessionId,
      turn: Turn,
      addTokens?: number,
      addUsage?: TokenUsage,
    ): Promise<void>;
  };
  terminal: {
    /** Spawn (or reuse) a PTY for this session with cwd = session.path. */
    open(
      sessionId: SessionId,
      cwd: string,
      cols: number,
      rows: number,
    ): Promise<{ reused: boolean }>;
    /** Forward keystrokes / paste data to the PTY. */
    write(sessionId: SessionId, data: string): Promise<void>;
    /** Tell the PTY about new viewport size. */
    resize(sessionId: SessionId, cols: number, rows: number): Promise<void>;
    /** Kill the PTY (e.g. tab closed, session deleted, user clicked trash). */
    close(sessionId: SessionId): Promise<void>;
    /** Subscribe to PTY output for any session; filter by `sessionId` inside. */
    onData(handler: (sessionId: SessionId, data: string) => void): Unsubscribe;
    /** Subscribe to PTY exit. `code` is the exit status (0 = clean). */
    onExit(handler: (sessionId: SessionId, code: number) => void): Unsubscribe;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}
