import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelId, Session, SessionId, Turn } from '@shared/types';
import { SEED_OPEN_IDS, SEED_SESSIONS } from '../data/seed';

export interface CreateSessionInput {
  name: string;
  path: string;
  model: ModelId;
  systemPrompt?: string;
  branch?: string;
}

interface SessionsState {
  sessions: Session[];
  openIds: SessionId[];
  activeId: SessionId | null;
  sideOpen: boolean;
  showNew: boolean;
  renamingId: SessionId | null;
  drafts: Record<SessionId, string>;
  typing: boolean;

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
  globalThis.crypto?.randomUUID?.() ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useSessions = create<SessionsState>()(
  persist(
    (set) => ({
      sessions: SEED_SESSIONS,
      openIds: SEED_OPEN_IDS,
      activeId: SEED_OPEN_IDS[0] ?? null,
      sideOpen: true,
      showNew: false,
      renamingId: null,
      drafts: {},
      typing: false,

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
        return session;
      },

      deleteSession: (id) =>
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
        }),

      startRename: (id) => set({ renamingId: id }),

      commitRename: (id, name) =>
        set((s) => {
          const trimmed = name?.trim();
          if (trimmed) {
            return {
              renamingId: null,
              sessions: s.sessions.map((x) =>
                x.id === id ? { ...x, name: trimmed } : x,
              ),
            };
          }
          return { renamingId: null };
        }),

      setSideOpen: (v) => set({ sideOpen: v }),
      toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
      setShowNew: (v) => set({ showNew: v }),

      setDraft: (id, text) => set((s) => ({ drafts: { ...s.drafts, [id]: text } })),
      setTyping: (v) => set({ typing: v }),

      appendTurn: (id, turn, addTokens = 0) =>
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
        })),
    }),
    {
      name: 'sessions',
      // Only persist what makes sense to keep across restarts.
      // Transient UI state (renamingId, showNew, typing) is intentionally excluded.
      partialize: (s) => ({
        sessions: s.sessions,
        openIds: s.openIds,
        activeId: s.activeId,
        sideOpen: s.sideOpen,
        drafts: s.drafts,
      }),
      version: 1,
    },
  ),
);

/** Selector — convenience for components that only need the active session. */
export function useActiveSession(): Session | null {
  return useSessions((s) =>
    s.activeId ? (s.sessions.find((x) => x.id === s.activeId) ?? null) : null,
  );
}
