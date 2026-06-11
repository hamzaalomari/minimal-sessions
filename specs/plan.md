# Implementation Plan — Minimal Sessions

Five milestones. Each is independently mergeable and leaves the app in a working state.

> **Status (2026-06-11):** M0 through M4 are merged and on `master`. M5 is the remaining work.

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

## M5 — Polish & ship

**Goal:** the app is ready to hand to another developer.

Pending tasks (most of the originally-specced M5 still applies, minus the API-key flow that no longer exists):

- ✅ Self-host JetBrains Mono and Newsreader fonts via `@fontsource/*`.
- ✅ Keyboard shortcuts: `⌘N` new session, `⌘1`–`⌘9` jump to tab N, `⌘\` toggle sidebar, `⌘,` open settings, `⌘F` open session search. (`⌘W` close tab was already wired.)
- ✅ Token meter / usage breakdown popover for the status bar — `sessions.tokens_*` columns persist input/output/cache-write/cache-read; `<TokenMeter>` + `<UsagePopover>` render the breakdown with per-model $/1M rates from `src/shared/pricing.ts`.
- ✅ Accessibility pass: ARIA labels on icon-only buttons audited (all labeled); tab order + focus rings audited — `SessionItem` rows and `TabBar` tabs are now keyboard-focusable (`tabindex=0`, Enter/Space activates, `:focus-visible` accent ring). Native buttons inherit the global `button:focus-visible` ring from `tokens.css`.
- ✅ Package: `electron-builder` 26.x wired in. `npm run package` produces installers for the host platform; `npm run package:mac` / `package:win` are explicit. macOS build verified locally — produces `dist/Minimal Sessions-<ver>-<arch>.dmg` and a matching `.zip`. `asarUnpack` keeps `better-sqlite3`'s native binary outside `app.asar` so Electron can `require()` it. **Open TODOs:** (1) code signing — `mac.identity` is set to `null` (skip) and Windows has no signing config; production builds need an Apple Developer ID + Windows Authenticode cert. (2) App icons — currently using the default Electron icon (warning logged at build time). (3) Cross-arch builds — the better-sqlite3 prebuild is host-arch only, so x64 Mac and Windows builds need to run on a matching host or in CI.
- `CONTRIBUTING.md` with dev / build / test commands.
- Smoke-test on a clean macOS install and a clean Windows install.

**Acceptance**

- [ ] `npm run package` produces working installers for macOS and Windows.
- [ ] All keyboard shortcuts behave as specified.
- [ ] The only external network call is what the Agent SDK / Claude binary makes — the app itself never reaches out.
- [ ] No console warnings in dev or production builds.

## Dependencies & ordering

```
M0 ──> M1 ──> M2 ──> M3 ──> M4 ──> M5
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
| M5 | 2-3 | pending |
| **Total** | **~12-17 days** | |
