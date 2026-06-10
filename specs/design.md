# Design — AI Work Viewer

> **Status (2026-06-11):** Reflects the M0–M4 implementation. Notable post-spec pivots (Agent SDK, History view, listbox model picker) are documented inline.

This document captures the architecture, tech stack, and the design tokens / component map. UI tokens are copied verbatim from the handoff; deviating from them is not an option for v1.

## 1. Tech stack

**Decision: Electron + React + TypeScript + Vite.**

| Concern | Choice | Rationale |
|---|---|---|
| Shell | Electron | Need local filesystem access, OS directory picker, native menus, and a custom title bar — all first-class in Electron. |
| UI framework | React 18 | The handoff is already React; porting is mechanical rather than re-architectural. |
| Language | TypeScript | The session/turn/block types are central and must be precise across the IPC boundary. |
| Build | Vite + electron-vite | Fast HMR for renderer; bundles main + preload + renderer with sensible defaults. |
| Styling | Plain CSS with CSS custom properties | The handoff is already authored as tokens on `[data-theme]`. No CSS-in-JS layer. |
| State (renderer) | Zustand (with `persist` middleware) | Lighter than Redux. UI scratch state (`openIds`, `activeId`, `sideOpen`, `drafts`) is persisted to localStorage; sessions + turns are persisted to SQLite via IPC. |
| Persistence | SQLite via `better-sqlite3` in the main process | Append-mostly relational data; sturdier than a JSON file once transcripts grow. |
| Claude integration | **`@anthropic-ai/claude-agent-sdk`** | Ships its own bundled Claude binary and uses the device's existing Claude Code auth — no in-app key entry, no `safeStorage`, no IPC for keys. (Originally specced as `@anthropic-ai/sdk`; pivoted during M4 — see `open-questions.md` Q16.) |
| Icons | Inline SVG | No external icon library — keeps bundle small and matches the handoff exactly. |
| Tests | Vitest + Testing Library + jsdom | Single test runner across main/renderer/shared. `predev` / `prebuild` hooks rebuild `better-sqlite3` for the Electron ABI so post-test dev launches don't crash. |

### Process boundary

- **Main process:** owns the SQLite DB, the Agent SDK `query()` calls, git branch reads, and the native folder picker. Streams `ChatEvent`s over IPC.
- **Renderer:** owns the UI, per-session draft state, and tweaks (theme/density). Calls main via a strictly-typed preload-exposed IPC surface. No `nodeIntegration`.
- **Preload:** exposes `window.api` with typed methods. No `remote`, no direct Node access from the renderer.

### Auth

The Agent SDK reuses whatever Claude auth is already on the device (OAuth subscription via `claude` login, or `ANTHROPIC_API_KEY` in the environment). The app itself never sees or stores a key.

## 2. App shell (CSS grid)

```
grid-template-columns: auto auto 1fr;   /* activitybar | sidebar | main */
grid-template-rows:    auto 1fr auto;   /* titlebar / body / statusbar */
grid-template-areas:
  "title  title  title"
  "act    side   main"
  "status status status";
```

- **Title bar** — 40px tall. Custom (frameless window). Traffic lights on macOS; minimize/maximize/close on Windows. Centered label is always **"AI Work Viewer"**.
- **Activity bar** — 52px wide. App mark + Sessions toggle + Search + **History (clock)** + (spacer) + Settings.
- **Sidebar** — 268px wide; collapses to 0 with `.side-collapsed`. Has two views: `sessions` and `history`.
- **Main** — fills remaining space; hosts tabs + transcript/empty + composer + overlays.
- **Status bar** — 28px tall; theme toggle only in v1.

The **New session panel** is rendered via `createPortal(document.body)` so its slide-in animation can't shift the main grid sideways. It animates `right: -460px → 0`.

## 3. Component map

| Component | Source | Purpose |
|---|---|---|
| `<App>` | `src/renderer/App.tsx` | Top-level state container, theming effect, panel mounting. Title is always "AI Work Viewer". |
| `<TitleBar>` | `src/renderer/components/TitleBar.tsx` | Traffic lights spacer + centered "AI Work Viewer" label. |
| `<ActivityBar>` | `src/renderer/components/ActivityBar.tsx` | App mark + Sessions / Search / **History (clock)** / Settings buttons. Toggling the active view collapses the sidebar. |
| `<Sidebar>` | `src/renderer/components/Sidebar.tsx` | Switches between **sessions** view and **history** view. History view shows soft-deleted sessions with Restore + permanent-delete buttons. |
| `<SessionItem>` | `src/renderer/components/SessionItem.tsx` | Row: model dot + name + time / path / model+messages / hover-only kebab. Kebab swaps in over the timestamp on hover. Inline rename. |
| `<TabBar>` | `src/renderer/components/TabBar.tsx` | Horizontal tabs, drag-reorder, close buttons, `+` → new-session panel. |
| `<Transcript>` | `src/renderer/components/Transcript.tsx` | Scrollable column. Renders `<SessionHead>` then turns. |
| `<SessionHead>` | `src/renderer/components/SessionHead.tsx` | Session h1 + meta chips (model / folder / branch). |
| `<Turn>` | `src/renderer/components/Turn.tsx` | Role badge + name + body (indented). |
| `<Block>` | `src/renderer/components/Block.tsx` | Dispatches to `<P>`, `<Heading>`, `<List>`, table, `<CodeBlock>`, `<ToolWindow>`. Legacy DB rows go through `parseMarkdown()` as a fallback. |
| `<CodeBlock>` | `src/renderer/components/CodeBlock.tsx` | Header (lang + copy) + highlighted body. |
| `<ToolWindow>` | `src/renderer/components/ToolWindow.tsx` | Expandable. Kinds: read / edit / write / search / **bash**. Bash kind is terminal-styled with the command in the header. Compact density shrinks padding/typography. |
| `<DiffView>` | `src/renderer/components/DiffView.tsx` | +/− gutter lines. |
| `<EmptyState>` | `src/renderer/components/EmptyState.tsx` | Centered card with mark, model, path, suggestion chips. "No session open" variant. |
| `<Composer>` | `src/renderer/components/Composer.tsx` | Auto-grow textarea + footer row. |
| `<NewSessionPanel>` | `src/renderer/components/NewSessionPanel.tsx` | Slide-in panel: name, folder picker, model dropdown, system-prompt field, footer. Portaled to `document.body`. |
| `<ModelPicker>` | `src/renderer/components/ModelPicker.tsx` | `/model`-style **listbox dropdown**. Lists every model the SDK advertises via `Query.supportedModels()`. Falls back to built-in `LOCAL_MODELS` if the SDK list fails. |
| `<SystemPromptField>` | `src/renderer/components/SystemPromptField.tsx` | Collapsible `<details>`-style block on the new-session panel and "Edit instructions" modal. |
| `<EditInstructionsModal>` | `src/renderer/components/EditInstructionsModal.tsx` | Modal launched from the session context menu's "Edit instructions" item. |
| `<SettingsPopover>` | `src/renderer/components/SettingsPopover.tsx` | Theme + density segmented controls. |
| `<ContextMenu>` | `src/renderer/components/ContextMenu.tsx` | Rename / Edit instructions / Close tab / Delete. Closes on outside mousedown but **not** on the trigger itself (`usePopoverClose` takes a `triggerEl` to short-circuit) so the same click can't reopen the menu. |
| `<Icon>` | `src/renderer/components/Icon.tsx` | Inline SVG dispatcher (24×24, 1.8px stroke, `currentColor`). |

### Shared modules

| Module | Purpose |
|---|---|
| `src/shared/types.ts` | `Session`, `Turn`, `Block`, `ToolKind`. The `Block` union includes `'table'` and `'bash'` kinds; `win` blocks have an optional `paths?: string[]` for coalesced multi-file windows. |
| `src/shared/api.ts` | `Api`, `ChatEvent`, `SdkModel`, `CreateSessionInput`. The single source of truth for the preload IPC surface. |
| `src/shared/markdown.ts` | `parseMarkdown(text) → Block[]`. Used by both `src/main/chat.ts` (when canonicalizing SDK output) and `src/renderer/components/Block.tsx` (as a fallback for legacy DB rows). Handles fenced code, ATX headers, lists, GFM tables, paragraphs. |
| `src/shared/tool-display.ts` | `toolKindFor()` / `pathForTool()` / `summaryFor()`. Shared between main (canonical block construction) and renderer (live streaming overlay) so the overlay shows the same label as the persisted block. |
| `src/shared/seed.ts` | Built-in `SEED_SESSIONS` used to seed an empty DB on first launch. |

## 4. Design tokens (CSS custom properties)

Theming is via CSS custom properties on `[data-theme="light|dark"]` on `<body>`. The renderer also writes `data-density="compact|cozy"` for density-aware selectors (e.g. tool windows shrink in compact mode).

### Accent

`--accent: #c4663f` (warm terracotta).

### Light theme

| Token | Value (oklch) |
|---|---|
| `--canvas` | `oklch(0.985 0.002 80)` |
| `--panel` | `oklch(1 0 0)` |
| `--rail` | `oklch(0.965 0.003 75)` |
| `--side` | `oklch(0.975 0.003 75)` |
| `--border` | `oklch(0.915 0.004 75)` |
| `--border-soft` | `oklch(0.945 0.003 75)` |
| `--text` | `oklch(0.28 0.012 60)` |
| `--dim` | `oklch(0.52 0.012 60)` |
| `--faint` | `oklch(0.66 0.010 60)` |
| `--hover` | `oklch(0.955 0.004 75)` |
| `--code-bg` | `oklch(0.972 0.004 75)` |
| `--user-bg` | `oklch(0.965 0.004 75)` |

### Dark theme

| Token | Value (oklch) |
|---|---|
| `--canvas` | `oklch(0.205 0.006 65)` |
| `--panel` | `oklch(0.235 0.007 65)` |
| `--rail` | `oklch(0.185 0.006 65)` |
| `--side` | `oklch(0.205 0.006 65)` |
| `--border` | `oklch(0.305 0.008 65)` |
| `--border-soft` | `oklch(0.27 0.007 65)` |
| `--text` | `oklch(0.925 0.004 80)` |
| `--dim` | `oklch(0.70 0.008 75)` |
| `--faint` | `oklch(0.55 0.010 70)` |
| `--hover` | `oklch(0.27 0.008 65)` |
| `--code-bg` | `oklch(0.185 0.006 65)` |
| `--user-bg` | `oklch(0.255 0.007 65)` |

### Model colors

- Opus `#9a6bff` · Sonnet `var(--accent)` · Haiku `#5b9a78`.

### Status / semantic

- Danger (delete) `#d2543f`.
- Traffic lights `#ec6a5e` / `#f4bf4f` / `#61c554`.

### Typography

- **UI sans** `--ui`: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Mono** `--mono`: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo`.
- **Serif** `--serif`: `"Newsreader"` (optional reading font).
- Base 14px; transcript body shifts by density (compact vs cozy).
- Self-hosting JetBrains Mono and Newsreader is **pending M5**.

### Spacing / density

- `body[data-density="compact"]` selectors shrink tool windows, code blocks, and turn gaps.

### Focus

- `button:focus-visible` uses `outline-offset: -2px` so the focus ring is inset and never bleeds into adjacent content.

## 5. State model

### Renderer (Zustand store)

```ts
type SessionId = string;
/** A specific model the SDK exposes, e.g. 'claude-opus-4-7'. */
type ModelId = string;
type ModelFamily = 'opus' | 'sonnet' | 'haiku';

type ToolKind = 'read' | 'edit' | 'write' | 'search' | 'bash';

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'tool'; label: string; path: string; tag?: string }
  | { type: 'win'; kind: ToolKind;
      path: string; paths?: string[];  /* set when multiple same-kind calls were coalesced */
      tag?: string; summary?: string;
      lang?: string; code?: string; diff?: string; defaultOpen?: boolean }
  | { type: 'error'; message: string };

type Turn = { id: string; role: 'user' | 'assistant'; blocks: Block[]; modelShort?: string; createdAt: number };

type Session = {
  id: SessionId;
  name: string;
  path: string;
  model: ModelId;
  systemPrompt: string;          // '' means no system prompt
  branch: string;
  createdAt: number;
  lastActiveAt: number;
  tokens: number;
  sdkSessionId: string;          // '' until the first turn completes; used for `resume:`
  turns: Turn[];
};

type AppState = {
  sessions: Session[];
  deletedSessions: Session[];    // soft-deleted, shown in History view
  sidebarView: 'sessions' | 'history';
  openIds: SessionId[];
  activeId: SessionId | null;
  sideOpen: boolean;
  showNew: boolean;
  renamingId: SessionId | null;
  drafts: Record<SessionId, string>;
  hydrated: boolean;
  home: string;                  // user home dir, for tilde-collapsing paths
  // Tweaks live in a separate Zustand store:
  // { theme: 'light' | 'dark'; accent: string; readFont: 'sans' | 'serif'; density: 'compact' | 'cozy' }
};
```

The `tweaks` and the partial `sessions` slice (`openIds`, `activeId`, `sideOpen`, `drafts`) are persisted to `localStorage` via `zustand/middleware`. Sessions and turns are the SQLite layer's source of truth — the renderer hydrates from main on startup.

### Main process (SQLite schema)

```sql
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,
  model           TEXT NOT NULL,
  system_prompt   TEXT NOT NULL DEFAULT '',
  branch          TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  last_active     INTEGER NOT NULL,
  tokens          INTEGER NOT NULL DEFAULT 0,
  sdk_session_id  TEXT NOT NULL DEFAULT '',  -- Agent SDK session id for `resume:`
  deleted_at      INTEGER NOT NULL DEFAULT 0 -- 0 = active; non-zero = soft-deleted at ts
);

CREATE TABLE turns (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  model_short TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX turns_session_order ON turns (session_id, created_at);
```

Migrations are idempotent: `openSessionsDb()` reads `PRAGMA table_info(sessions)` and `ALTER TABLE` adds `sdk_session_id` / `deleted_at` if missing, so older DBs upgrade on first launch.

Blocks are stored as JSON in one column rather than normalized — they're write-once, read-as-a-unit.

## 6. IPC surface

Exposed on `window.api` via the preload script.

```ts
interface Api {
  app: {
    ping(): Promise<'pong'>;
    platform(): Promise<Platform>;
    closeWindow(): Promise<void>;
    homeDir(): Promise<string>;
    onRequestCloseTab(handler: () => void): Unsubscribe;
  };
  fs: {
    pickDirectory(): Promise<string | null>;
    branchFor(path: string): Promise<string>;
    isReadableDir(path: string): Promise<boolean>;
  };
  models: {
    /** All models the locally-installed Claude SDK advertises. Cached per session. */
    list(): Promise<SdkModel[]>;
  };
  chat: {
    /** Begin a streaming chat turn. Resolves on `turn-stop`. */
    send(sessionId: SessionId, userText: string, turnId: string): Promise<void>;
    /** Subscribe to chat events for *all* sessions; filter by `sessionId` inside the handler. */
    onEvent(handler: (sessionId: SessionId, event: ChatEvent) => void): Unsubscribe;
  };
  sessions: {
    list(): Promise<Session[]>;                          // active, sorted by last_active DESC
    listDeleted(): Promise<Session[]>;                   // soft-deleted, sorted by deleted_at DESC
    create(input: CreateSessionInput): Promise<Session>;
    rename(id: SessionId, name: string): Promise<void>;
    updateSystemPrompt(id: SessionId, systemPrompt: string): Promise<void>;
    delete(id: SessionId): Promise<void>;                // soft delete → moves to history
    restore(id: SessionId): Promise<void>;               // restore from history
    purge(id: SessionId): Promise<void>;                 // permanent delete
  };
  turns: {
    list(sessionId: SessionId): Promise<Turn[]>;
    append(sessionId: SessionId, turn: Turn, addTokens?: number): Promise<void>;
  };
}

type SdkModel = { id: string; displayName: string; description: string };

type ChatEvent =
  | { type: 'turn-start'; turnId: string; modelShort?: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; toolId: string; name: string; input: unknown }
  | { type: 'tool-result'; toolId: string; content: string; isError?: boolean }
  | { type: 'turn-stop'; turnId: string; blocks: Block[]; addTokens: number; sdkSessionId: string }
  | { type: 'error'; message: string };
```

There is **no `settings.getApiKey` / `setApiKey`** — the Agent SDK owns auth. (This is the v1 pivot from the original spec; see `open-questions.md` Q16.)

### Streaming flow

1. Renderer calls `api.chat.send(sessionId, userText, turnId)`.
2. Main loads the session, runs `runStreamingTurn(realQuery, …)` which calls `sdkQuery()` with `cwd`, `model`, optional `resume`, optional `systemPrompt`, and `permissionMode: 'bypassPermissions'`.
3. The SDK streams `SDKMessage`s. Main translates each into `ChatEvent`s and emits over IPC.
4. Tool calls are coalesced into multi-path windows in `applyAssistant()` (except `bash`, which is always its own window).
5. On `result`, main persists `sdkSessionId` to the DB and emits `turn-stop` with the canonical `blocks[]` + `addTokens`.
6. Renderer `appendTurn()`s the persisted blocks and updates `sdkSessionId` in the store.

## 7. Animations

| Element | Animation |
|---|---|
| New-session panel | `right: -460px → 0`, `0.26s cubic-bezier(.22,.7,.3,1)` (portaled to body so it can't shift the grid) |
| Scrim fade | `0.18s` |
| Sidebar collapse | `width 0.18s` |
| Typing dots | `blink 1.2s` staggered |

## 8. Implementation gotchas

- **Buttons don't inherit text color.** Any `<button>` containing text needs `color: var(--text)` explicitly.
- **Syntax highlighting must render React nodes, not `innerHTML`.** Avoids XSS and serialization issues.
- **Token usage from the SDK, not heuristics.** `addTokens = result.usage.input_tokens + result.usage.output_tokens`.
- **Folder picker is OS-native.** `dialog.showOpenDialog({ properties: ['openDirectory'] })` in main.
- **Focus rings must be inset** (`outline-offset: -2px`) — `2px` ones bleed into adjacent buttons (e.g. tab close X) when the user clicks then tabs/capslocks.
- **Popovers close on outside mousedown but NOT on their trigger** — pass the trigger element to `usePopoverClose` so the same click that opens a popover doesn't immediately close it, and a second click on the trigger toggles it closed instead of reopening it.
- **`predev` / `prebuild` hooks** run `electron-rebuild -w better-sqlite3` because `npm test` rebuilds the binding for Node's ABI and `electron-vite dev` needs Electron's ABI. Without the hooks, `npm run dev` after a test run crashes with `NODE_MODULE_VERSION` mismatch.
- **Tool windows coalesce read/edit/write/search/glob/grep**, but **never bash** — each shell command stays its own window.
- **Live streaming overlay** uses the shared `tool-display.ts` helpers so the in-flight label matches the persisted `win` block exactly.
- **Window title is constant** ("AI Work Viewer") — the active session name lives in the tab and transcript header, not the OS-level title.
