import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelId, Session, SessionId, Turn } from '@shared/types';

export interface CreateSessionInput {
  name: string;
  path: string;
  model: ModelId;
  systemPrompt?: string;
  branch?: string;
}

interface SessionsState {
  /** Loaded from SQLite via window.api on hydrate(). */
  sessions: Session[];
  openIds: SessionId[];
  activeId: SessionId | null;
  sideOpen: boolean;
  showNew: boolean;
  renamingId: SessionId | null;
  drafts: Record<SessionId, string>;
  typing: boolean;
  /** Set to true once hydrate() has returned (success or failure). */
  hydrated: boolean;

  /** Load sessions from main-process SQLite. Idempotent. */
  hydrate(): Promise<void>;
  selectSession(id: SessionId): void;
  closeTab(id: SessionId): void;
  reorderTabs(dragId: SessionId, targetId: SessionId): void;
  createSession(input: CreateSessionInput): Session;
  deleteSession(id: SessionId): void;
  startRename(id: SessionId): void;
  commitRename(id: SessionId, name: string | null): void;
  setSideOpen(v: boolean): void;
  toggleSide(): void;
  setShowNew(v: boolean): void;
  setDraft(id: SessionId, text: string): void;
  setTyping(v: boolean): void;
  appendTurn(id: SessionId, turn: Turn, addTokens?: number): void;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useSessions = create<SessionsState>()(
  persist(
    (set) => ({
      sessions: [],
      openIds: [],
      activeId: null,
      sideOpen: true,
      showNew: false,
      renamingId: null,
      drafts: {},
      typing: false,
      hydrated: false,

      hydrate: async () => {
        const sessions = await window.api.sessions.list();
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
          return { sessions, openIds: firstRunOpen, activeId, hydrated: true };
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
          return { openIds, activeId };
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

      createSession: ({ name, path, model, systemPrompt = '', branch = '' }) => {
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
          })
          .catch(() => {
            /* ignore — tests may stub a partial api */
          });
        return session;
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = s.sessions.filter((x) => x.id !== id);
          const openIds = s.openIds.filter((x) => x !== id);
          const activeId =
            s.activeId === id ? (openIds[openIds.length - 1] ?? null) : s.activeId;
          const { [id]: _omit, ...drafts } = s.drafts;
          void _omit;
          return {
            sessions,
            openIds,
            activeId,
            drafts,
            renamingId: s.renamingId === id ? null : s.renamingId,
          };
        });
        void window.api?.sessions.delete(id).catch(() => {});
      },

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
      setTyping: (v) => set({ typing: v }),

      appendTurn: (id, turn, addTokens = 0) => {
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id
              ? {
                  ...x,
                  turns: [...x.turns, turn],
                  lastActiveAt: Date.now(),
                  tokens: x.tokens + addTokens,
                }
              : x,
          ),
        }));
        void window.api?.turns.append(id, turn, addTokens).catch(() => {});
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
      }),
      version: 2,
    },
  ),
);

/** Selector — convenience for components that only need the active session. */
export function useActiveSession(): Session | null {
  return useSessions((s) =>
    s.activeId ? (s.sessions.find((x) => x.id === s.activeId) ?? null) : null,
  );
}
