# Implementation Plan — Claude Session Viewer

Five milestones. Each is independently mergeable and leaves the app in a working state. Each milestone ends with a checklist of acceptance criteria that map back to the requirements in `spec.md`.

## M0 — Project scaffolding

**Goal:** an Electron + React + TypeScript app boots, with strict process boundaries and the design tokens loaded.

**Tasks**

- Initialize `package.json`, install React 18, TypeScript, Vite, electron-vite, ESLint, Prettier.
- Set up the three-process structure: `src/main`, `src/preload`, `src/renderer`.
- Configure `electron-vite.config.ts` and `tsconfig.json` for each process.
- Add the frameless window with the `titleBarStyle: 'hiddenInset'` on macOS and custom controls on Windows.
- Port `app/icons.jsx` verbatim to `src/renderer/components/Icon.tsx` as a typed component.
- Create `src/renderer/styles/tokens.css` containing every custom property from `design.md §4` (both themes).
- Wire `useTweaks` (theme, accent, readFont, density) to a Zustand store and `[data-theme]` on `<body>`.
- Add a smoke test: app boots, shows an empty grid shell with the title bar and activity bar visible, theme toggle flips light/dark.

**Acceptance**

- [ ] `npm run dev` opens the app with a hot-reloading renderer.
- [ ] Light/dark toggle flips every component in the rendered shell.
- [ ] No `nodeIntegration` in the renderer; preload exposes only a typed `window.api`.

## M1 — App shell (chrome, no data)

**Goal:** all chrome from the handoff is on screen with mocked session data — no Claude integration yet.

**Tasks**

- Implement `<TitleBar>`, `<ActivityBar>`, `<Sidebar>`, `<TabBar>`, `<StatusBar>` per `design.md §3`.
- Implement the empty states ("No session open" and per-session start card).
- Implement `<SettingsPopover>` and `<ContextMenu>` (Rename / Close tab / Delete).
- Implement `<NewSessionPanel>` shell — the form, model cards, slide-in animation. The folder field is wired to a placeholder until M3.
- Implement `<Transcript>`, `<Turn>`, `<Block>`, `<CodeBlock>`, `<ToolWindow>`, `<DiffView>` using the seed sessions from `app/data.jsx`.
- Implement `<Composer>` with auto-grow, Enter/Shift+Enter, and per-session drafts; on send, just append a hard-coded canned reply (round-robin like the handoff) — no API yet.
- Tab drag-reorder via HTML5 DnD.
- Inline rename via the sidebar context menu.

**Acceptance**

- [ ] All seed sessions from `app/data.jsx` render identically to the handoff prototype side-by-side.
- [ ] Tabs can be reordered by dragging.
- [ ] Composer drafts persist when switching tabs.
- [ ] Sidebar collapses and expands smoothly.
- [ ] Settings popover and session context menu close on outside click.

## M2 — Persistence (SQLite + IPC)

**Goal:** sessions and transcripts survive an app restart.

**Tasks**

- Add `better-sqlite3`; rebuild for Electron's Node ABI via `electron-rebuild`.
- Create the schema from `design.md §5` in `app.getPath('userData')/sessions.db`.
- Implement the `sessions.*` and `turns.*` IPC methods in main with prepared statements.
- Wire the renderer store to lazily load sessions on startup and hydrate via IPC.
- Persist `turns` on every append (after a send / reply); persist `sessions` on create, rename, delete, model change, and after each turn's token total updates.
- Migrate the `tweaks`, `openIds`, `activeId` to `localStorage` (renderer-local, no IPC round-trip).

**Acceptance**

- [ ] Create a session, send a message (still canned reply), restart the app — session and turns are exactly where they were.
- [ ] Deleting a session removes it from disk and closes its tab.
- [ ] No SQLite file handles leak when sessions are deleted (cascade delete works).

## M3 — Filesystem integration

**Goal:** the working folder is real; git branch shows up automatically.

**Tasks**

- Replace the mocked finder with the OS-native picker: `dialog.showOpenDialog({ properties: ['openDirectory'] })` in main; expose via `api.fs.pickDirectory()`.
- Add `api.fs.branchFor(path)` — reads `.git/HEAD` in main, returns the branch name or `''`.
- Display the absolute path with `~/` tilde-expansion for the user's home, both in the new-session panel and the status bar.
- Validate that the folder exists and is readable before allowing session create; show an inline error in the panel if not.

**Acceptance**

- [ ] Browse… opens the native picker; selecting a folder fills the path field and auto-suggests a name.
- [ ] Git branch shows correctly for repos; blank for non-git folders.
- [ ] Renaming or deleting the folder on disk after session creation does not crash the app — the session is marked as "folder missing" but is still readable.

## M4 — Claude integration

**Goal:** real Claude conversations, streaming, with tool use against the working folder.

**Tasks**

- Add `@anthropic-ai/sdk` in main only.
- Implement API key entry: a first-run modal asks for the key; stored via `safeStorage` to the OS keychain. `api.settings.getApiKey()` returns boolean only — the key never crosses the IPC boundary.
- Implement `api.chat.send(sessionId, userText, onEvent)`:
  - Loads the full turn history from SQLite, converts it to Anthropic's `messages` shape.
  - Sets `model` per session (Opus 4.6 / Sonnet 4.6 / Haiku 4.6).
  - Streams via `client.messages.stream()`; pipes `text-delta`, `tool-use-start`, `tool-result`, `message-stop` events back over IPC.
- Implement the sandboxed tool runner — when Claude requests `read_file`, `write_file`, `run_command`, `list_dir`, or `search`, run it against the session's working folder only. Reject any path that resolves outside the working folder.
- Map streaming events into Block updates: text deltas append to the trailing `'p'` block, tool calls open a `'win'` block, tool results fill its body.
- Update `session.tokens` from the real `usage` field on `message-stop`.
- Render API errors (rate limit, network, 401, etc.) as an inline error block in the transcript — do not crash the renderer.

**Acceptance**

- [ ] Real Claude reply streams into the transcript token-by-token.
- [ ] Token meter updates with real usage from the API response.
- [ ] Asking Claude to "read the README" produces a `read` tool window with the actual file contents.
- [ ] Asking Claude to read a path outside the session folder is refused server-side (the tool runner returns an error result back to Claude).
- [ ] An invalid API key shows a clear error block, not a crash.

## M5 — Polish & ship

**Goal:** the app is ready to hand to another developer.

**Tasks**

- Self-host JetBrains Mono and Newsreader fonts; remove any Google Fonts references.
- Add the usage breakdown popover from `chrome.jsx` (`<UsagePopover>`) with the real-data cost estimate.
- Keyboard shortcuts: `⌘N` new session, `⌘W` close tab, `⌘1`–`⌘9` jump to tab N, `⌘\\` toggle sidebar, `⌘,` open settings.
- Accessibility pass: focus rings on every interactive element, ARIA labels on icon-only buttons, tab order audit.
- Package: `electron-builder` configs for macOS (.dmg) and Windows (.exe) installers; code-signing TODO noted.
- Write a `CONTRIBUTING.md` with the dev/build/test commands.
- Smoke-test on a clean macOS install and a clean Windows install.

**Acceptance**

- [ ] Lighthouse-style accessibility audit: no critical issues.
- [ ] `npm run package` produces working installers for macOS and Windows.
- [ ] All keyboard shortcuts behave as specified.
- [ ] No external network calls except to `api.anthropic.com`.

## Dependencies & ordering

```
M0 ──> M1 ──> M2 ──> M3 ──> M4 ──> M5
```

M3 could technically interleave with M2, but doing M2 first gives us a stable persistence layer to test M3 changes against.

## Estimated effort

Rough order-of-magnitude only (one engineer, full-time):

| Milestone | Days |
|---|---|
| M0 | 1-2 |
| M1 | 4-5 |
| M2 | 1-2 |
| M3 | 1 |
| M4 | 3-4 |
| M5 | 2-3 |
| **Total** | **~12-17 days** |

Numbers will shift once we resolve the items in `open-questions.md`.
