# Design — Claude Session Viewer

This document captures the architecture, tech stack, and the design tokens / component map. UI tokens are copied verbatim from the handoff; deviating from them is not an option for v1.

## 1. Tech stack

**Decision: Electron + React + TypeScript + Vite.**

| Concern | Choice | Rationale |
|---|---|---|
| Shell | Electron | Need local filesystem access, OS directory picker, OS keychain for the API key, native menus, and a custom title bar — all first-class in Electron. Tauri is the alternative but its filesystem permission model is heavier-handed for the dynamic per-session folder scoping we need. |
| UI framework | React 18 | The handoff is already React; porting is mechanical rather than re-architectural. |
| Language | TypeScript | The session/turn/block types are central and must be precise across the IPC boundary. |
| Build | Vite + electron-vite | Fast HMR for renderer; bundles main + preload + renderer with sensible defaults. |
| Styling | Plain CSS with CSS custom properties | The handoff is already authored as tokens on `[data-theme="light\|dark"]`. No need for a CSS-in-JS layer. |
| State (renderer) | Zustand | Lighter than Redux, no boilerplate, plays nicely with persistence middleware. The handoff's state shape fits in one store. |
| Persistence | SQLite via `better-sqlite3` in the main process | Sessions and turns are append-mostly relational data; SQLite is sturdier than a JSON file once transcripts grow. |
| Claude SDK | `@anthropic-ai/sdk` | Called only from the main process so the API key never touches the renderer. |
| Icons | Inline SVG, ported 1:1 from `app/icons.jsx` | No external icon library — keeps bundle small and matches the handoff exactly. |

### Process boundary

- **Main process:** owns the SQLite DB, the Anthropic SDK client, the API key (from `safeStorage` / OS keychain), the per-session sandboxed filesystem tool runner, and git branch reads.
- **Renderer:** owns the UI, the per-session draft state, and the tweaks (theme/accent/density). Calls main via a strictly-typed preload-exposed IPC surface (no `nodeIntegration` in the renderer).
- **Preload:** exposes `window.api` with typed methods. No `remote`, no direct Node access from the renderer.

## 2. App shell (CSS grid)

```
grid-template-columns: auto auto 1fr;   /* activitybar | sidebar | main */
grid-template-rows:    auto 1fr auto;   /* titlebar / body / statusbar */
grid-template-areas:
  "title  title  title"
  "act    side   main"
  "status status status";
```

- **Title bar** — 40px tall. Custom (frameless window). Traffic lights on macOS; minimize/maximize/close on Windows.
- **Activity bar** — 52px wide. App mark + Sessions toggle + Search + (spacer) + Settings.
- **Sidebar** — 268px wide; collapses to 0 with `.side-collapsed` (column → `auto 0 1fr`, `width .18s`).
- **Main** — fills remaining space; hosts tabs + transcript/empty + composer + overlays.
- **Status bar** — 28px tall.

`body { overflow: hidden }`. Only the transcript and session list scroll internally.

## 3. Component map

Mirrors the handoff structure; each item below is one React component or one file's worth of components.

| Component | Source ref | Purpose |
|---|---|---|
| `<App>` | `app/main.jsx` | Top-level state container, theming effect, panel mounting. |
| `<TitleBar>` | inline in handoff `main.jsx` | Traffic lights + centered active session name. |
| `<ActivityBar>` | `app/chrome.jsx` | App mark + icon buttons (Sessions, Search, Settings). |
| `<Sidebar>` | `app/chrome.jsx` | Header (title + count + New button) + scrollable session list. |
| `<SessionItem>` | `app/chrome.jsx` | Row: model dot + name + time / path / model+messages / hover kebab. Active state. Inline rename. |
| `<TabBar>` | `app/chrome.jsx` | Horizontal tabs, drag-reorder, close buttons, `+` button → new-session panel. |
| `<StatusBar>` | `app/chrome.jsx` | Branch + path / model + token meter + theme toggle. |
| `<UsagePopover>` | `app/chrome.jsx` | Context-usage breakdown anchored above the meter. |
| `<Transcript>` | `app/session.jsx` | Scrollable column (max-w 760, padded). Renders `<SessionHead>` then turns then optional typing indicator. |
| `<SessionHead>` | `app/session.jsx` | Session h1 + meta chips (model / folder / branch). |
| `<Turn>` | `app/session.jsx` | Role badge + name + body (indented). |
| `<Block>` | `app/session.jsx` | Dispatches to `<P>`, `<Heading>`, `<List>`, `<CodeBlock>`, `<ToolLine>`, `<ToolWindow>`. |
| `<CodeBlock>` | `app/session.jsx` | Header (lang + copy) + highlighted body. |
| `<ToolWindow>` | `app/session.jsx` | Expandable: read (code), edit (diff), write, search. (No `run` — see `spec.md` FR-M4.) |
| `<DiffView>` | `app/session.jsx` | +/− gutter lines. |
| `<EmptyState>` | `app/session.jsx` | Centered card with mark, model, path, suggestion chips. Plus a "No session open" variant. |
| `<Composer>` | `app/session.jsx` | Auto-grow textarea + footer row (attach, model chip, hint, send). |
| `<NewSessionPanel>` | `app/newsession.jsx` | Slide-in panel: name, folder picker, model list, system-prompt field, footer. |
| `<ModelPicker>` | new in v1 | Grouped list of all available Claude models (Opus/Sonnet/Haiku families). Collapsed default shows the recommended model per family; "Show all models" expands the full list. |
| `<SystemPromptField>` | new in v1 | Collapsible `<details>` block on the new-session panel and the "Edit instructions" dialog. Textarea with the session's system prompt; placeholder is the default coding-assistant prompt. |
| `<SettingsPopover>` | `app/newsession.jsx` | Theme + density segmented controls. |
| `<ContextMenu>` | `app/newsession.jsx` | Rename / Close tab / Delete on session items. |
| `<Icon>` | `app/icons.jsx` | Inline SVG dispatcher (24×24, 1.8px stroke, `currentColor`). |

## 4. Design tokens (CSS custom properties)

Theming is via CSS custom properties on `[data-theme="light|dark"]` on `<body>`. Colors are authored in **oklch**.

### Accent

`--accent: #c4663f` (warm terracotta). Tweakable: `#c4663f`, `#2f6dd0`, `#1f8a5b`, `#7a5ae0`, `#3b3b3b`.

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

Derived for both themes:
- `--active = color-mix(in oklch, var(--accent) 12-22%, var(--panel))`
- selection = `color-mix(in oklch, var(--accent) 30%, transparent)`

### Model colors

- Opus `#9a6bff` · Sonnet `var(--accent)` · Haiku `#5b9a78`.

### Status / semantic

- Token meter warn `#e0a32e`, hot `#dd6b55`.
- Danger (delete) `#d2543f`.
- Code string green `#6a9b5c` (light) / `#9bc88a` (dark).
- Traffic lights `#ec6a5e` / `#f4bf4f` / `#61c554`.

### Typography

- **UI sans** `--ui`: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Mono** `--mono`: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo`.
- **Serif** `--serif`: `"Newsreader"` (optional reading font).
- **Reading font** `--read`: swaps between UI sans and serif for the transcript body.
- Base 14px. Transcript body `--read-size` 15-16.5px, `--read-line` 1.55-1.68 (by density).
- Self-host JetBrains Mono and Newsreader; do not load from Google Fonts at runtime.

### Spacing / density

- `--turn-gap`: 22px (compact) / 32px (cozy).
- Radii: buttons/inputs 10-11px, cards/code 13-15px, badges 6-9px.

### Shadows

- Light `--shadow`: `0 1px 2px rgba(40,33,20,.05), 0 8px 30px rgba(40,33,20,.07)`
- Light `--shadow-lg`: `0 24px 70px rgba(30,24,12,.16)`
- Dark equivalents use `rgba(0,0,0,.3 / .35 / .55)`.

## 5. State model

### Renderer (Zustand store)

```ts
type SessionId = string;
/** A specific model the API exposes, e.g. 'claude-opus-4-7'. */
type ModelId = string;
type ModelFamily = 'opus' | 'sonnet' | 'haiku';

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'tool'; label: string; path: string; tag?: string }
  | { type: 'win'; kind: 'read' | 'edit' | 'write' | 'search';
      path: string; tag?: string; summary?: string;
      lang?: string; code?: string; diff?: string; defaultOpen?: boolean }
  | { type: 'error'; message: string };

type Turn = { id: string; role: 'user' | 'assistant'; blocks: Block[]; modelShort?: string };

type Session = {
  id: SessionId;
  name: string;
  path: string;
  /** Specific model ID, not just the family — e.g. 'claude-sonnet-4-6'. */
  model: ModelId;
  /** Optional per-session system prompt. Empty string means no system prompt. */
  systemPrompt: string;
  branch: string;
  createdAt: number;
  lastActiveAt: number;
  tokens: number;
  turns: Turn[];
};

type AppState = {
  sessions: Session[];
  openIds: SessionId[];
  activeId: SessionId | null;
  sideOpen: boolean;
  showNew: boolean;
  drafts: Record<SessionId, string>;
  typing: boolean;
  tweaks: { theme: 'light' | 'dark'; accent: string; readFont: 'sans' | 'serif'; density: 'compact' | 'cozy' };
};
```

The `tweaks` and `openIds` / `activeId` are persisted to local storage (cheap, frequently written). Sessions and turns are persisted to SQLite via the main process.

### Main process (SQLite schema)

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,
  model         TEXT NOT NULL,           -- e.g. 'claude-sonnet-4-6'
  system_prompt TEXT NOT NULL DEFAULT '',
  branch        TEXT,
  created_at    INTEGER NOT NULL,
  last_active   INTEGER NOT NULL,
  tokens        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE turns (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,   -- 'user' | 'assistant'
  blocks_json TEXT NOT NULL,   -- serialized Block[]
  model_short TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX turns_session_order ON turns (session_id, created_at);
```

Blocks are stored as JSON in one column rather than normalized — they're write-once, read-as-a-unit, and the schema would otherwise need a row-per-block-type which is over-engineered for v1.

## 6. IPC surface

Exposed on `window.api` via the preload script. All methods are async and typed.

```ts
interface Api {
  sessions: {
    list(): Promise<Session[]>;
    create(input: { name: string; path: string; model: ModelId; systemPrompt: string }): Promise<Session>;
    rename(id: string, name: string): Promise<void>;
    updateSystemPrompt(id: string, systemPrompt: string): Promise<void>;
    delete(id: string): Promise<void>;
  };
  turns: {
    list(sessionId: string): Promise<Turn[]>;
    append(sessionId: string, turn: Turn): Promise<void>;
  };
  chat: {
    /** Sends a message; streams assistant blocks back via the provided callback. */
    send(sessionId: string, userText: string,
         onEvent: (e: ChatEvent) => void): Promise<{ usage: Usage }>;
  };
  fs: {
    pickDirectory(): Promise<string | null>;     // OS-native picker
    branchFor(path: string): Promise<string>;    // reads .git/HEAD
  };
  models: {
    /** Lists every Claude model the API exposes, grouped by family. */
    list(): Promise<{ family: ModelFamily; models: { id: ModelId; label: string; tier: string; description: string }[] }[]>;
  };
  settings: {
    getApiKey(): Promise<boolean>;               // true if key is set in keychain
    setApiKey(key: string): Promise<void>;       // stored via safeStorage
  };
}
```

`ChatEvent` covers `text-delta`, `tool-call-start`, `tool-result`, `done`, and `error`. **No** `run_command` tool — the v1 tool surface is `read_file`, `write_file`, `list_dir`, `search` only.

## 7. Animations

| Element | Animation |
|---|---|
| Panel slide-in | `slidein .26s cubic-bezier(.22,.7,.3,1)` |
| Scrim / finder fades | `fade .14-.18s` |
| Finder scale-in | `popin .16s` |
| Sidebar collapse | `width .18s` |
| Typing dots | `blink 1.2s` staggered |

## 8. Implementation gotchas (from the handoff)

- **Buttons don't inherit text color.** Any `<button>` containing text needs `color: var(--text)` explicitly. The handoff specifically calls this out for `.model-card` — name went black in dark mode without it.
- **Syntax highlighting must render React nodes, not `innerHTML`.** Avoids XSS and serialization issues.
- **Token usage from the API, not heuristics.** The handoff fakes it as `chars / 3.6`; we use the real `usage` field from each response.
- **Folder picker is mocked in the handoff.** Replace with `dialog.showOpenDialog({ properties: ['openDirectory'] })` in the main process.
- **In-browser Babel in the handoff is for prototyping only.** We use a real Vite build with tsc type-checking.
