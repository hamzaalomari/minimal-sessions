import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelId, Session, SessionId, TokenUsage, Turn } from '@shared/types';
import { ZERO_USAGE } from '@shared/types';

export interface CreateSessionInput {
  name: string;
  path: string;
  model: ModelId;
  systemPrompt?: string;
  branch?: string;
  /** If set, the new session resumes this past Claude Code session id on the first turn. */
  sdkSessionId?: string;
}

export type SidebarView = 'sessions' | 'history' | 'search' | 'analytics' | 'plugins';

/** One write into a session's PTY, plus the wait before it. Used for flows
 *  that need to start a TUI and then send a slash command into it — the
 *  initial Sign-in-to-Claude path is the load-bearing case. */
export interface PendingTerminalStep {
  text: string;
  /** Milliseconds to wait BEFORE writing this step. Defaults to 250ms (enough
   *  time for the shell prompt to print before our characters arrive). For
   *  steps that follow a `claude\n`, allow ~2000ms so claude has time to
   *  finish booting the REPL and is ready to receive slash commands. */
  delayMs?: number;
}

interface SessionsState {
  /** Loaded from SQLite via window.api on hydrate(). */
  sessions: Session[];
  /** Soft-deleted sessions, surfaced in the History view. */
  deletedSessions: Session[];
  /** Which list the sidebar is showing right now. */
  sidebarView: SidebarView;
  openIds: SessionId[];
  activeId: SessionId | null;
  sideOpen: boolean;
  showNew: boolean;
  renamingId: SessionId | null;
  drafts: Record<SessionId, string>;
  /** Set to true once hydrate() has returned (success or failure). */
  hydrated: boolean;
  /** User home directory — for tilde-collapsing displayed paths. Loaded once on hydrate(). */
  home: string;
  /** Active query in the sidebar Search view. Empty string = no filter. */
  searchQuery: string;
  /** Sessions whose embedded terminal panel is currently open. */
  terminalOpenIds: SessionId[];
  /** Sessions with an in-flight assistant turn. Transient — never persisted. */
  streamingIds: SessionId[];
  /** Sequence of writes to send into a session's PTY once it's ready. Each
   *  step is { text, delayMs } — delayMs is the wait BEFORE writing the step
   *  (after PTY open for the first one, or after the previous step otherwise).
   *
   *  Used by the "Sign in to Claude" flow (start claude, wait, send `/login`)
   *  and the Plugin marketplace install flow. The Terminal component consumes
   *  (and clears) the queue on PTY open. */
  pendingTerminalCommands: Record<SessionId, PendingTerminalStep[]>;
  /** Plugin `installId`s the user has dispatched at least once. Used in the
   *  Plugin marketplace to badge already-tried plugins. We don't actually
   *  know if the install succeeded — the terminal owns that — but knowing
   *  the user has *seen* the install command run is enough to avoid the
   *  CTA shouting "Install" at them next time. */
  dispatchedInstalls: string[];

  /** Load sessions from main-process SQLite. Idempotent. */
  hydrate(): Promise<void>;
  selectSession(id: SessionId): void;
  closeTab(id: SessionId): void;
  reorderTabs(dragId: SessionId, targetId: SessionId): void;
  createSession(input: CreateSessionInput): Session;
  /** Soft-delete: removes from sessions + tabs and adds to deletedSessions. */
  deleteSession(id: SessionId): void;
  /** Bring a soft-deleted session back into sessions. */
  restoreSession(id: SessionId): void;
  /** Permanently delete a session that was already in the History bucket. */
  purgeSession(id: SessionId): void;
  /** Permanently delete every session currently in the History bucket. */
  purgeAllDeleted(): void;
  setSidebarView(view: SidebarView): void;
  setSearchQuery(q: string): void;
  /** Show/hide the embedded terminal for `id`. Toggling off also kills the PTY. */
  toggleTerminalOpen(id: SessionId): void;
  /** Schedule one or more writes to send into the session's PTY the next
   *  time it's open and ready. Pass a single string for the common case;
   *  pass an array of `PendingTerminalStep` for flows that need delays
   *  between writes (e.g. start claude, wait, send `/login`). */
  setPendingTerminalCommand(
    id: SessionId,
    cmd: string | PendingTerminalStep[],
  ): void;
  /** Pop and return any scheduled steps — Terminal component calls this
   *  after the PTY signals it's ready. Returns undefined when empty. */
  consumePendingTerminalCommand(id: SessionId): PendingTerminalStep[] | undefined;
  /** Mark `installId` as one the user has dispatched. Adds to the persisted
   *  set — idempotent. */
  markInstallDispatched(installId: string): void;
  startRename(id: SessionId): void;
  commitRename(id: SessionId, name: string | null): void;
  setSideOpen(v: boolean): void;
  toggleSide(): void;
  setShowNew(v: boolean): void;
  setDraft(id: SessionId, text: string): void;
  appendTurn(
    id: SessionId,
    turn: Turn,
    addTokens?: number,
    addUsage?: TokenUsage,
  ): void;
  updateSystemPrompt(id: SessionId, prompt: string): void;
  /** Cache the Agent SDK session id locally — persistence happens in main. */
  setSdkSessionId(id: SessionId, sdkSessionId: string): void;
  /** Mark a session as currently streaming (in-flight assistant turn). */
  setStreaming(id: SessionId, on: boolean): void;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useSessions = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      deletedSessions: [],
      sidebarView: 'sessions',
      openIds: [],
      activeId: null,
      sideOpen: true,
      showNew: false,
      renamingId: null,
      drafts: {},
      hydrated: false,
      home: '',
      searchQuery: '',
      terminalOpenIds: [],
      streamingIds: [],
      pendingTerminalCommands: {},
      dispatchedInstalls: [],

      hydrate: async () => {
        const [sessions, deletedSessions, home] = await Promise.all([
          window.api.sessions.list(),
          window.api.sessions.listDeleted().catch(() => [] as Session[]),
          window.api.app.homeDir().catch(() => ''),
        ]);
        set((s) => {
          // Filter any persisted openIds/activeId against what the DB returned,
          // so a session deleted out-of-band doesn't leave an orphan tab.
          const validIds = new Set(sessions.map((x) => x.id));
          const openIds = s.openIds.filter((id) => validIds.has(id));
          // First-run UX: nothing open but we have seeded sessions → open the
          // most-recently-active one. listSessions() is sorted by last_active DESC.
          const firstRunOpen =
            openIds.length === 0 && sessions.length > 0 ? [sessions[0]!.id] : openIds;
          const activeId =
            s.activeId && validIds.has(s.activeId)
              ? s.activeId
              : (firstRunOpen[0] ?? null);
          return {
            sessions,
            deletedSessions,
            openIds: firstRunOpen,
            activeId,
            hydrated: true,
            home,
          };
        });
      },

      selectSession: (id) =>
        set((s) => ({
          activeId: id,
          openIds: s.openIds.includes(id) ? s.openIds : [...s.openIds, id],
        })),

      closeTab: (id) =>
        set((s) => {
          const openIds = s.openIds.filter((x) => x !== id);
          const activeId =
            s.activeId === id ? (openIds[openIds.length - 1] ?? null) : s.activeId;
          void window.api?.terminal?.close(id).catch(() => {});
          return {
            openIds,
            activeId,
            terminalOpenIds: s.terminalOpenIds.filter((x) => x !== id),
          };
        }),

      reorderTabs: (dragId, targetId) => {
        if (!dragId || dragId === targetId) return;
        set((s) => {
          const from = s.openIds.indexOf(dragId);
          const to = s.openIds.indexOf(targetId);
          if (from < 0 || to < 0) return s;
          const next = [...s.openIds];
          next.splice(from, 1);
          next.splice(to, 0, dragId);
          return { openIds: next };
        });
      },

      createSession: ({
        name,
        path,
        model,
        systemPrompt = '',
        branch = '',
        sdkSessionId = '',
      }) => {
        const now = Date.now();
        const session: Session = {
          id: newId(),
          name,
          path,
          model,
          systemPrompt,
          branch,
          createdAt: now,
          lastActiveAt: now,
          tokens: 0,
          usage: { ...ZERO_USAGE },
          sdkSessionId,
          turns: [],
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          openIds: [...s.openIds, session.id],
          activeId: session.id,
          showNew: false,
        }));
        // Persist asynchronously; the renderer treats local state as authoritative.
        void window.api?.sessions
          .create({
            id: session.id,
            name,
            path,
            model,
            systemPrompt,
            branch,
            createdAt: now,
            ...(sdkSessionId ? { sdkSessionId } : {}),
          })
          .catch(() => {
            /* ignore — tests may stub a partial api */
          });
        return session;
      },

      deleteSession: (id) => {
        set((s) => {
          const target = s.sessions.find((x) => x.id === id);
          const sessions = s.sessions.filter((x) => x.id !== id);
          const openIds = s.openIds.filter((x) => x !== id);
          const activeId =
            s.activeId === id ? (openIds[openIds.length - 1] ?? null) : s.activeId;
          const { [id]: _omit, ...drafts } = s.drafts;
          void _omit;
          void window.api?.terminal?.close(id).catch(() => {});
          // Prepend the session to history so the most recent deletion is on top.
          const deletedSessions = target
            ? [target, ...s.deletedSessions.filter((x) => x.id !== id)]
            : s.deletedSessions;
          return {
            sessions,
            deletedSessions,
            openIds,
            activeId,
            drafts,
            terminalOpenIds: s.terminalOpenIds.filter((x) => x !== id),
            renamingId: s.renamingId === id ? null : s.renamingId,
          };
        });
        void window.api?.sessions.delete(id).catch(() => {});
      },

      restoreSession: (id) => {
        set((s) => {
          const target = s.deletedSessions.find((x) => x.id === id);
          if (!target) return {};
          return {
            sessions: [target, ...s.sessions.filter((x) => x.id !== id)],
            deletedSessions: s.deletedSessions.filter((x) => x.id !== id),
          };
        });
        void window.api?.sessions.restore(id).catch(() => {});
      },

      purgeSession: (id) => {
        set((s) => ({
          deletedSessions: s.deletedSessions.filter((x) => x.id !== id),
        }));
        void window.api?.sessions.purge(id).catch(() => {});
      },

      purgeAllDeleted: () => {
        // Clear local state optimistically — even if the IPC fails, the worst
        // case is a stale view that refreshes on next launch.
        set({ deletedSessions: [] });
        void window.api?.sessions.purgeAllDeleted().catch(() => {});
      },

      setSidebarView: (view) => set({ sidebarView: view }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      toggleTerminalOpen: (id) =>
        set((s) => {
          if (s.terminalOpenIds.includes(id)) {
            void window.api?.terminal?.close(id).catch(() => {});
            return { terminalOpenIds: s.terminalOpenIds.filter((x) => x !== id) };
          }
          return { terminalOpenIds: [...s.terminalOpenIds, id] };
        }),

      setPendingTerminalCommand: (id, cmd) => {
        const steps: PendingTerminalStep[] =
          typeof cmd === 'string' ? [{ text: cmd }] : cmd;
        set((s) => ({
          pendingTerminalCommands: { ...s.pendingTerminalCommands, [id]: steps },
        }));
      },

      consumePendingTerminalCommand: (id) => {
        const steps = get().pendingTerminalCommands[id];
        if (!steps || steps.length === 0) return undefined;
        set((s) => {
          const next = { ...s.pendingTerminalCommands };
          delete next[id];
          return { pendingTerminalCommands: next };
        });
        return steps;
      },

      markInstallDispatched: (installId) =>
        set((s) =>
          s.dispatchedInstalls.includes(installId)
            ? s
            : { dispatchedInstalls: [...s.dispatchedInstalls, installId] },
        ),

      startRename: (id) => set({ renamingId: id }),

      commitRename: (id, name) => {
        const trimmed = name?.trim();
        set((s) => {
          if (trimmed) {
            return {
              renamingId: null,
              sessions: s.sessions.map((x) =>
                x.id === id ? { ...x, name: trimmed } : x,
              ),
            };
          }
          return { renamingId: null };
        });
        if (trimmed) {
          void window.api?.sessions.rename(id, trimmed).catch(() => {});
        }
      },

      setSideOpen: (v) => set({ sideOpen: v }),
      toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
      setShowNew: (v) => set({ showNew: v }),

      setDraft: (id, text) => set((s) => ({ drafts: { ...s.drafts, [id]: text } })),

      updateSystemPrompt: (id, prompt) => {
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, systemPrompt: prompt } : x,
          ),
        }));
        void window.api?.sessions.updateSystemPrompt(id, prompt).catch(() => {});
      },

      setSdkSessionId: (id, sdkSessionId) => {
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, sdkSessionId } : x,
          ),
        }));
      },

      setStreaming: (id, on) =>
        set((s) => {
          const has = s.streamingIds.includes(id);
          if (on && !has) return { streamingIds: [...s.streamingIds, id] };
          if (!on && has) return { streamingIds: s.streamingIds.filter((x) => x !== id) };
          return {};
        }),

      appendTurn: (id, turn, addTokens = 0, addUsage) => {
        const usage = addUsage ?? { ...ZERO_USAGE };
        const hasUsage =
          usage.input || usage.output || usage.cacheCreation || usage.cacheRead;
        // Embed usage on the turn itself so the analytics view can date-filter
        // without a DB round-trip. Skip when zeros (e.g. user turns).
        const enriched: Turn = hasUsage ? { ...turn, usage } : turn;
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id
              ? {
                  ...x,
                  turns: [...x.turns, enriched],
                  lastActiveAt: Date.now(),
                  tokens: x.tokens + addTokens,
                  usage: {
                    input: x.usage.input + usage.input,
                    output: x.usage.output + usage.output,
                    cacheCreation: x.usage.cacheCreation + usage.cacheCreation,
                    cacheRead: x.usage.cacheRead + usage.cacheRead,
                  },
                }
              : x,
          ),
        }));
        void window.api?.turns.append(id, enriched, addTokens, usage).catch(() => {});
      },
    }),
    {
      name: 'sessions',
      // SQLite is the source of truth for sessions + turns. We only persist the
      // UI bits that don't belong in the DB so the renderer can paint the same
      // tabs/sidebar state across launches before hydrate() returns.
      partialize: (s) => ({
        openIds: s.openIds,
        activeId: s.activeId,
        sideOpen: s.sideOpen,
        drafts: s.drafts,
        dispatchedInstalls: s.dispatchedInstalls,
      }),
      version: 3,
    },
  ),
);

/** Selector — convenience for components that only need the active session. */
export function useActiveSession(): Session | null {
  return useSessions((s) =>
    s.activeId ? (s.sessions.find((x) => x.id === s.activeId) ?? null) : null,
  );
}

/** Selector — the user's home directory. Used to tilde-collapse displayed paths. */
export function useHomeDir(): string {
  return useSessions((s) => s.home);
}
