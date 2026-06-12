# Implementation Plan — Minimal Sessions

Six milestones. Each is independently mergeable and leaves the app in a working state.

> **Status (2026-06-13):** M0 through M5 are merged on `master`. M6 is mostly merged — a small punch list remains (see below).

## M0 — Project scaffolding ✅

**Goal:** an Electron + React + TypeScript app boots, with strict process boundaries and the design tokens loaded.

Done. Highlights of what shipped:

- React 18 + TypeScript + Vite + electron-vite + ESLint + Prettier.
- Three-process structure: `src/main`, `src/preload`, `src/renderer`, with `src/shared` for cross-process types/utilities.
- Frameless window: `titleBarStyle: 'hiddenInset'` on macOS, `titleBarOverlay` on Windows.
- `Icon.tsx` ported 1:1 from the handoff.
- `tokens.css` with light + dark themes per `design.md §4`.
- Tweaks store (theme/accent/readFont/density) wired to `[data-theme]` / `[data-density]` on `<body>`.
- Vitest + Testing Library covering the M0 surface.

## M1 — App shell (chrome, no data) ✅

**Goal:** all chrome from the handoff is on screen with mocked session data.

Done. Highlights:

- `<TitleBar>`, `<ActivityBar>`, `<Sidebar>`, `<TabBar>`, status bar.
- Empty states: "No session open" and the per-session start card.
- `<SettingsPopover>` and `<ContextMenu>`.
- `<NewSessionPanel>` shell with the form, `<ModelPicker>`, and `<SystemPromptField>`.
- `<Transcript>`, `<Turn>`, `<Block>`, `<CodeBlock>`, `<ToolWindow>`, `<DiffView>` rendering seed data.
- `<Composer>` with auto-grow, Enter/Shift+Enter, per-session drafts, canned-reply round robin (replaced in M4).
- Tab drag-reorder via HTML5 DnD.
- Inline rename via the sidebar context menu.

## M2 — Persistence (SQLite + IPC) ✅

**Goal:** sessions and transcripts survive an app restart.

Done. Highlights:

- `better-sqlite3` with prebuilt binaries via `prebuild-install`. ABI flip-flop between `npm test` (Node) and `npm run dev` (Electron) is handled by `predev` / `prebuild` / `pretest` hooks calling `scripts/rebuild-native.mjs` (M5).
- Schema in `app.getPath('userData')/sessions.db`.
- `sessions.*` and `turns.*` IPC methods with prepared statements.
- Renderer hydrates from main on startup.
- UI state (`openIds`, `activeId`, `sideOpen`, `drafts`) persisted to `localStorage`.

## M3 — Filesystem integration ✅

**Goal:** the working folder is real; git branch shows up automatically.

Done. Highlights:

- `api.fs.pickDirectory()` opens the native picker.
- `api.fs.branchFor(path)` reads `.git/HEAD`, returns the branch name or `''`.
- `api.fs.isReadableDir(path)` validates folder before allowing session create.
- Absolute paths tilde-collapsed for display (`~/dev/foo`).

## M4 — Claude integration ✅

**Goal:** real Claude conversations, streaming, with tool use against the working folder.

**Pivot:** the original plan was to bring up `@anthropic-ai/sdk` + first-run API-key entry + `safeStorage` + a custom sandboxed tool runner. During implementation we replaced all of that with **`@anthropic-ai/claude-agent-sdk`**, which:

- ships its own bundled Claude binary,
- reuses the device's existing Claude Code auth (OAuth subscription or `ANTHROPIC_API_KEY`),
- owns its own tool surface (including bash) and sandboxing.

The user no longer enters an API key. There is no `safeStorage`, no `settings.getApiKey/setApiKey`, no custom tool runner. See `open-questions.md` Q16 for the trade-off.

Done. Highlights:

- `src/main/chat.ts` wraps `sdkQuery()` and streams `SDKMessage`s into `ChatEvent`s.
- `runStreamingTurn()` coalesces consecutive same-kind tool calls (read/edit/write/search/glob/grep) into a single `win` block with a `paths[]` array. **Bash is never coalesced** — each command is its own terminal-styled window.
- `listSupportedModels()` calls `Query.supportedModels()` so the picker reflects whatever the locally-installed SDK advertises. Falls back to `LOCAL_MODELS` when unreachable.
- `api.chat.send(sessionId, userText, turnId)` runs the turn in main and streams over IPC.
- Session's `sdkSessionId` is captured on `turn-stop` and passed as `resume:` on subsequent sends.
- Markdown parser (`src/shared/markdown.ts`) handles fenced code, ATX headers, lists, **GFM tables**, paragraphs. Used by both main (canonicalizing SDK text) and renderer (legacy DB rows).
- Live streaming overlay uses the shared `tool-display.ts` helpers so the in-flight label matches the persisted `win` block.
- `<EditInstructionsModal>` wired to `api.sessions.updateSystemPrompt()` from the session context menu.
- Errors surface as inline error blocks in the transcript; the SDK never crashes the renderer.

### Post-M4 polish (already shipped on `master`)

- **History view + soft delete.** `sessions` got a `deleted_at` column. Sidebar has a History view reached from the activity bar's clock icon. Each history row has **Restore** + **trash** (permanent delete with confirm).
- **Listbox model picker.** Replaced the grouped-by-family model cards with a `/model`-style listbox dropdown.
- **Sidebar kebab UX.** Kebab swaps in over the timestamp on hover so they don't overlap. Second click closes the menu (`usePopoverClose` takes a `triggerEl` so the trigger doesn't re-open it).
- **Tool-window compact mode.** `body[data-density="compact"]` selectors shrink padding/typography.
- **Focus rings inset.** `outline-offset: -2px` so focus on the chat input doesn't bleed into adjacent UI when the user hits capslock.
- **New session panel portaled.** `createPortal(document.body)`, animates `right: -460px → 0` — eliminates a frame where the panel was outside the viewport and shifted the grid.
- **Window title is constant.** "Minimal Sessions" (matching `productName` in `package.json`). Active session name lives in the tab + transcript header.
- **ABI flip-flop fix.** `predev` / `prebuild` npm scripts auto-rebuild `better-sqlite3` for Electron's ABI.

## M5 — Polish & ship ✅

**Goal:** the app is ready to hand to another developer.

Done. Highlights:

- ✅ Self-host JetBrains Mono and Newsreader fonts via `@fontsource/*`.
- ✅ Keyboard shortcuts: `⌘N` new session, `⌘1`–`⌘9` jump to tab N, `⌘\` toggle sidebar, `⌘,` open settings, `⌘F` open session search, `⌘J` toggle terminal. (`⌘W` close tab was already wired.)
- ✅ Token meter / usage breakdown popover for the status bar — `sessions.tokens_*` columns persist input/output/cache-write/cache-read; `<TokenMeter>` + `<UsagePopover>` render the breakdown with per-model $/1M rates from `src/shared/pricing.ts`.
- ✅ Accessibility pass: ARIA labels on icon-only buttons audited (all labeled); tab order + focus rings audited — `SessionItem` rows and `TabBar` tabs are keyboard-focusable (`tabindex=0`, Enter/Space activates, `:focus-visible` accent ring). Native buttons inherit the global `button:focus-visible` ring from `tokens.css`.
- ✅ Brand + packaging: app icons wired (`resources/icon.png`, dev Dock override on macOS); `electron-builder` 26.x produces `dist/Minimal Sessions-<ver>-<arch>.dmg` + matching `.zip` for macOS and an NSIS installer for Windows; `asarUnpack` keeps `better-sqlite3` and `node-pty` native binaries outside `app.asar`.

### M5 punch list (still open)

- **Code signing.** `mac.identity` is `null` (skip); Windows has no signing config. Production builds need an Apple Developer ID + Windows Authenticode cert.
- **Cross-arch builds.** The `better-sqlite3` prebuild is host-arch only. x64 Mac and Windows installers need a matching host or CI matrix.
- **`CONTRIBUTING.md`** — dev / build / test commands not yet documented for outside contributors.
- **Smoke-test on a clean macOS install and a clean Windows install.**

## M6 — Product depth (post-ship)

**Goal:** turn the app from "a Claude session manager" into an actual day-to-day workbench for parallel coding sessions.

Mostly merged on `master`; a small set of follow-ups is itemised at the bottom.

Done. Highlights:

- **Token-by-token streaming.** `chat.ts` sets `includePartialMessages: true` and forwards SDK `stream_event` `content_block_delta` text deltas as `text-delta` events. A `streamedAnyText` flag suppresses the consolidated assistant message's text-delta emit so the live overlay isn't doubled, and falls back to emitting from the assistant message when no partials arrived (test mocks, older SDK builds).
- **Embedded terminal sub-tab.** Each session pane has a Chat / Terminal switcher above the transcript. Terminal is a real PTY (`node-pty`) running the user's default shell in `session.path`, rendered via xterm.js. Drag-resizable handle; persisted height in tweaks. The Transcript instance is preserved across the toggle so scroll position survives.
- **Analytics view.** Sidebar gains an `analytics` view showing total tokens and cost across all sessions, a per-model breakdown, and a time-range selector (24h / 7d / 30d / all). Per-turn `usage` is persisted in new `turns.tokens_*` columns; legacy turns without per-turn usage attribute to `session.lastActiveAt` so empty filtered ranges don't look broken.
- **Browser-style nav.** Mouse buttons 4/5 (`app-command`) and `⌘⌥←` / `⌘⌥→` pop and re-push entries on a cursor-based stack tracking `{activeId, sidebarView}`. A `suppressNext` flag prevents feedback loops.
- **Slash command discovery + autocomplete.** `discoverCommands(cwd)` walks four sources in priority order: project (`<cwd>/.claude/commands/*.md`), user (`~/.claude/commands/*.md`), plugin (`<plugin>/commands/*.md` namespaced as `pluginName:cmd`), and built-in (`resources/commands/*.md` bundled via `extraResources`). Minimal regex frontmatter scanner pulls `description:`. The Composer detects `/`-prefix, flips into skill mode (chip + accent border), and shows a `SlashSuggestions` popover with arrow-key nav and Tab/Enter to insert.
- **SDK plugin loading.** `discoverPlugins(cwd)` finds every dir under `~/.claude/plugins/*/` and `<cwd>/.claude/plugins/*/` with a `.claude-plugin/plugin.json` manifest and passes the paths to `sdkQuery({options:{plugins}})`. Plugin slash commands, skills, hooks, agents, and MCP servers all surface automatically.
- **Branch / worktree from the New Session panel.** Three-way segmented control under the folder picker: use current / new branch / new worktree. New branch runs `git -C <path> switch -c <name>`; new worktree runs `git -C <path> worktree add <path>-<name> -b <name>` (sibling dir, predictable, previewed in the UI). Errors bubble up verbatim. `branchFor` now follows the `.git`-as-a-file pointer worktrees use.
- **Theme system overhaul.** Two-layer `data-theme` + `data-preset` attributes on body. Palette presets (warm / paper / mist; classic / midnight / ocean / slate) compose with light/dark. Accent presets, `--chat-max-width` and `--code-size` text/density scale, composer style toggle (panel vs. terminal-prompt), and a code-theme picker that injects one of 10 stock highlight.js themes via Vite `?raw`. Hardcoded `.hljs-*` rules gated behind `body[data-code-theme='default']` so picked themes win the cascade.
- **Composer & transcript UX.** Auto-grow ceiling 400px with a thin fading scrollbar; large pastes (≥15 lines or ≥1500 chars) collapse into `[Pasted #N: K lines]` placeholders, expanded at send time. Click anywhere inside the pane "arms" typing — next printable key lands in the composer without a visible focus jump; clicking outside disarms. Send bumps a `pinToBottomNonce` that force-scrolls the transcript; existing sticky-bottom during streaming is unchanged.
- **Transcript memoization.** `Transcript`, `Turn`, `Block`, `CodeBlock` are all `React.memo`; `Block` and `CodeBlock` use `useMemo` around `parseMarkdown` and `highlightNodes`. Typing in the composer no longer re-runs hljs on the whole thread.
- **Tab cycling shortcuts.** `Ctrl+Tab` / `Ctrl+Shift+Tab` (VSCode + browser standard), `⌘+~`, `⌘+PgUp/PgDn`, `⌘+Shift+[/]`. Bound via the Window menu with hidden alias items. `Cmd+Tab` intentionally not bound on macOS.
- **History delete-all.** History view header gains a destructive "Delete all" button (only when there's history) that purges every soft-deleted session in one DB statement (turns cascade via FK).
- **System prompt visibility.** SessionHead shows a `system prompt` chip when a session has one configured. Both global (tweaks) and per-session prompts continue to be concatenated and passed every turn — covered by four `chat.test.ts` cases.
- **Bundled starter commands.** `resources/commands/` ships `security-review`, `explain`, `test`, `refactor`, `diff-review`, `commit`. Installed by `extraResources`, surfaced as lowest-priority `'builtin'` scope so user files always win.

### M6 punch list (still open)

- **Plugin marketplace integration.** Browse / install plugins from inside the app. Currently users drop folders into `~/.claude/plugins/` by hand or run `claude plugin install` in a shell.
- **One-click "Connect to Claude" UX.** For users who haven't run `claude login`, surface a button that drops them into a PTY pre-running `claude login`.
- **More built-in commands.** Currently 6 — `pr-description`, `migration`, `bench`, etc. would round out the set.
- **Skill discovery UI.** The SDK can autonomously invoke skills from `plugin/skills/<name>/SKILL.md`. We pass the plugin path so they load, but don't surface them in any UI yet.
- **Auto-update channel.** No update mechanism shipped.

**Acceptance**

- [ ] `npm run package` produces signed installers for macOS (Developer ID) and Windows (Authenticode).
- [ ] All keyboard shortcuts behave as specified.
- [ ] The only external network call is what the Agent SDK / Claude binary makes — the app itself never reaches out.
- [ ] No console warnings in dev or production builds.
- [ ] First-launch UX: a developer who has *not* run `claude login` is given a clear path forward (currently degrades silently).

## Dependencies & ordering

```
M0 ──> M1 ──> M2 ──> M3 ──> M4 ──> M5 ──> M6
```

## Effort

Rough order-of-magnitude only (one engineer, full-time):

| Milestone | Days | Status |
|---|---|---|
| M0 | 1-2 | ✅ |
| M1 | 4-5 | ✅ |
| M2 | 1-2 | ✅ |
| M3 | 1 | ✅ |
| M4 | 3-4 | ✅ (incl. post-M4 polish) |
| M5 | 2-3 | ✅ (punch list pending) |
| M6 | 5-7 | ✅ (punch list pending) |
| **Total** | **~17-24 days** | |
