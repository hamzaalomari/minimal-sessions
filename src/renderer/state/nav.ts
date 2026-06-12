import { create } from 'zustand';
import type { SessionId } from '@shared/types';
import type { SidebarView } from './sessions';
import { useSessions } from './sessions';

export interface NavEntry {
  activeId: SessionId | null;
  sidebarView: SidebarView;
}

interface NavStore {
  /** Linear browser-style stack. The entry at `stack[cursor]` is what the
   *  user is currently looking at; entries after the cursor are forward
   *  history that gets cleared on any forward-truncating navigation. */
  stack: NavEntry[];
  cursor: number;
  /** Set to true while goBack/goForward is applying an entry, so the
   *  push-on-change subscription below doesn't re-record that change as a
   *  fresh navigation. */
  suppressNext: boolean;

  /** Record a new navigation, truncating any forward history. Skips if the
   *  entry is identical to the current top of stack. */
  push(entry: NavEntry): void;
  goBack(): NavEntry | null;
  goForward(): NavEntry | null;
  canGoBack(): boolean;
  canGoForward(): boolean;
}

const MAX_HISTORY = 100;

function sameEntry(a: NavEntry, b: NavEntry): boolean {
  return a.activeId === b.activeId && a.sidebarView === b.sidebarView;
}

export const useNav = create<NavStore>((set, get) => ({
  stack: [],
  cursor: -1,
  suppressNext: false,

  push(entry) {
    const { stack, cursor } = get();
    const top = cursor >= 0 ? stack[cursor] : undefined;
    if (top && sameEntry(top, entry)) return;
    const truncated = stack.slice(0, cursor + 1);
    truncated.push(entry);
    const trimmed =
      truncated.length > MAX_HISTORY
        ? truncated.slice(truncated.length - MAX_HISTORY)
        : truncated;
    set({ stack: trimmed, cursor: trimmed.length - 1 });
  },

  goBack() {
    const { stack, cursor } = get();
    if (cursor <= 0) return null;
    const next = cursor - 1;
    set({ cursor: next, suppressNext: true });
    return stack[next] ?? null;
  },

  goForward() {
    const { stack, cursor } = get();
    if (cursor >= stack.length - 1) return null;
    const next = cursor + 1;
    set({ cursor: next, suppressNext: true });
    return stack[next] ?? null;
  },

  canGoBack() {
    return get().cursor > 0;
  },

  canGoForward() {
    const { stack, cursor } = get();
    return cursor < stack.length - 1;
  },
}));

let initialized = false;

/** Wire the nav store to the sessions store. Should be called once at app
 *  startup. Subsequent calls are no-ops so we don't double-subscribe. */
export function initNavTracking(): void {
  if (initialized) return;
  initialized = true;

  // Seed with the current state so "Back" has somewhere to go after the
  // user's first navigation.
  const seed = useSessions.getState();
  useNav.getState().push({
    activeId: seed.activeId,
    sidebarView: seed.sidebarView,
  });

  useSessions.subscribe((state, prev) => {
    if (state.activeId === prev.activeId && state.sidebarView === prev.sidebarView) {
      return;
    }
    const nav = useNav.getState();
    if (nav.suppressNext) {
      useNav.setState({ suppressNext: false });
      return;
    }
    nav.push({ activeId: state.activeId, sidebarView: state.sidebarView });
  });
}

/** Apply a NavEntry to the sessions store. The nav store's `suppressNext`
 *  flag prevents this from triggering a re-push. */
export function applyNavEntry(entry: NavEntry): void {
  const s = useSessions.getState();
  if (entry.activeId && entry.activeId !== s.activeId) {
    s.selectSession(entry.activeId);
  }
  if (entry.sidebarView !== s.sidebarView) {
    s.setSidebarView(entry.sidebarView);
  }
}
