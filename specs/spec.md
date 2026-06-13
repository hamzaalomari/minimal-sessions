# Spec — Minimal Sessions

> **Status (2026-06-13):** Implementation is past M6 (with a small punch list — see `plan.md`). The spec is updated in place to match what shipped; the original intent is preserved. Sections added during M6 are flagged (M6).

## 1. Problem

Developers using Claude for coding work juggle multiple parallel investigations: one branch needs a bugfix, another needs a refactor, a third is exploring a new feature. Today they either run multiple terminal Claude Code sessions (no shared UI, hard to switch between) or open multiple browser tabs (no filesystem access, no per-folder scoping).

We need a single desktop-style app where each conversation is **scoped to a working folder on disk and a chosen model**, and where switching between conversations feels like switching tabs in an IDE.

## 2. Product summary

**Minimal Sessions** — a VS Code–style desktop app for browsing and running multiple Claude coding sessions in parallel. The user can:

- See all sessions in a left sidebar (model, folder path, message count, last active).
- Open sessions as named, drag-reorderable tabs across the top.
- Start a new session via a slide-in panel: name it, pick a working folder, pick a model.
- Read the conversation as a clean document-style transcript with markdown, code blocks, tool windows, and a terminal-style view for bash.
- Send messages via a composer with per-session draft preservation.
- Soft-delete sessions into a **History** view, then either restore or permanently delete them.
- Toggle light/dark and density, rename and edit per-session instructions.

The app uses the locally-installed **Claude Agent SDK** for chat, so it inherits whatever auth the user already has set up (subscription or `ANTHROPIC_API_KEY`). There is no in-app API-key entry.

## 3. Users & primary scenarios

**Primary user**: a working software engineer who already uses Claude (Claude Code, API, or subscription) for day-to-day coding.

**Scenarios:**

1. **Parallel investigations.** I'm debugging an auth issue in `auth-service` while also drafting a marketing copy rewrite in `marketing-site`. I want to flip between them as tabs without losing context.
2. **Pick the right model per job.** Opus for the gnarly debugging, Haiku for the quick copy edits. Each session remembers its model.
3. **Scope to a real folder.** When I say "look at the middleware," Claude should be reading files from the folder I picked, not guessing.
4. **Keep history.** Sessions persist across app restarts so I can come back to yesterday's debugging trail. Deleted sessions land in **History** for a possible restore.

## 4. Functional requirements

### 4.1 Sessions

- **FR-S1.** A session is `{ id, name, path, model, systemPrompt, branch, createdAt, lastActiveAt, tokens, sdkSessionId, turns[] }`. `sdkSessionId` is the Agent SDK's session id from the most recent turn — used to resume context on the next send.
- **FR-S2.** The user can **create** a session by providing a name (optional — auto-suggested from folder), a working folder (required), a model, and an optional system prompt.
- **FR-S3.** The user can **rename** a session inline in the sidebar (Enter commits, Escape/blur cancels).
- **FR-S4.** The user can **soft-delete** a session — removes it from the active list and closes its tab; the session is moved to **History**. Permanent deletion happens from the History view.
- **FR-S5.** Sessions **persist** across app restarts (list, transcripts, drafts, tokens, system prompt, sdkSessionId, deletion state).
- **FR-S6.** Each session displays its current **git branch** for the working folder (read from `.git/HEAD`); blank if not a git repo.
- **FR-S7.** The model picker is a **listbox dropdown** modeled after Claude Code's `/model` output. It lists every model the locally-installed Claude SDK advertises via `Query.supportedModels()`. Each row shows the display name, a one-line description, and a check next to the current selection. If the SDK list can't be reached, the picker falls back to a built-in set of recent models.
- **FR-S8.** Each session has a **configurable system prompt** that is forwarded to the SDK on every send. The new-session panel exposes it as an expandable "Custom instructions" field with a sensible coding-assistant default. After creation, the user can edit it via the session context menu → "Edit instructions". Empty system prompt is allowed and means "no system prompt". A global system prompt is also editable in Settings; the two are concatenated (`<global>\n\n<session>`) before the SDK call. SessionHead shows a small `system prompt` chip when the session-level prompt is set, so it's discoverable that one is active (M6).

### 4.2 Tabs

- **FR-T1.** Selecting a session from the sidebar opens it as a tab (if not already open) and focuses it.
- **FR-T2.** Tabs are **closeable**; closing the active tab activates the previous remaining tab, or shows the "No session open" state.
- **FR-T3.** Tabs are **drag-reorderable** (HTML5 drag-and-drop).
- **FR-T4.** The window title is **"Minimal Sessions"** at all times; the active session name appears in the active tab and in the transcript header, not in the title bar.

### 4.3 Transcript

- **FR-R1.** A turn is `{ id, role: 'user' | 'assistant', blocks: Block[], modelShort?, createdAt }`.
- **FR-R2.** Block kinds supported: paragraph, heading, bulleted list, fenced code block (with language label), GFM-style table, tool line, expandable **tool window** with body, and inline error.
- **FR-R3.** Inline formatting in paragraphs and list items: `**bold**`, `*italic*`, and `` `inline code` ``.
- **FR-R4.** Code blocks have **light syntax highlighting** rendered as React nodes — never `innerHTML`.
- **FR-R5.** Transcript pins to the bottom while the user is at the bottom and force-scrolls when they hit Send. If they scroll up to read history, incoming streamed content does **not** drag them back down — they stay pinned to wherever they are until they manually return to the bottom. Implemented via a sticky-bottom flag + a `pinToBottomNonce` counter bumped on send.
- **FR-R6.** A typing indicator shows while the assistant has not yet started producing content.
- **FR-R7.** Empty session shows an empty-state card with the model name, folder path, and prefill suggestion chips.
- **FR-R8.** **Tool windows** render per `kind`:
  - `read` / `edit` / `write` / `search` — file paths in the header; consecutive same-kind tool calls are **coalesced** into one window with a `paths[]` list.
  - `bash` — terminal-style window with the command in the header and stdout/stderr in the body; never coalesced (each shell command is its own window). The live overlay shows the actual command while the model is still streaming, not a placeholder.

### 4.4 Composer

- **FR-C1.** Auto-growing textarea (ceiling 400px). Past the ceiling the textarea becomes scrollable with a thin webkit scrollbar that fades to transparent when not hovered or focused.
- **FR-C2.** **Enter** sends; **Shift+Enter** inserts a newline. **Esc** while streaming aborts the in-flight turn.
- **FR-C3.** Drafts are stored **per session** so switching tabs preserves unsent text.
- **FR-C4.** Send button disabled when empty or while a reply is pending. While busy, the send button becomes a Stop button that cancels the SDK stream and finalizes a "Stopped." marker locally.
- **FR-C5.** Composer shows the session's model as a chip and the working folder name in the placeholder.
- **FR-C6.** **Large paste collapsing (M6).** Pasting ≥15 lines or ≥1500 characters substitutes a `[Pasted #N: K lines]` placeholder at the caret. The full text is stored in a ref, and the placeholders are expanded back to the original content at send time.
- **FR-C7.** **Click-to-arm typing (M6).** Clicking anywhere inside the session pane (outside the composer textarea itself) arms the pane: the next printable keystroke is routed into the composer and focused. Clicking outside the pane disarms. This avoids the focus-cursor-jump that a click-to-focus pattern would cause, while still letting users start typing from anywhere in the pane.
- **FR-C8.** **Slash command UI (M6).** When the input starts with `/`, the composer-box flips into skill mode and shows a slash-command autocomplete popover. See FR-K5.

### 4.5 Messaging (Claude integration)

- **FR-M1.** On send, append a user turn locally, then call `@anthropic-ai/claude-agent-sdk`'s `query()` from the main process. The SDK ships its own Claude binary and uses the device's existing Claude auth.
- **FR-M2.** **Stream** the assistant response into the transcript as the SDK emits `SDKMessage`s; the typing indicator stays until the first text/tool content arrives.
- **FR-M3.** Token usage per turn comes from the SDK's `result.usage` field (input + output tokens). The session's running `tokens` total updates on `turn-stop`.
- **FR-M4.** When the SDK reports **tool use** (read, write, edit, glob, grep, bash, etc.), each call renders as a tool window in the transcript and its result fills the window body. The tool surface is whatever the bundled Claude binary advertises — **including bash**. Sandboxing the tools is the SDK/binary's responsibility, not ours.
- **FR-M5.** Errors from the SDK (init failure, abort, non-success result) render as an inline error block in the transcript, not as a crash.
- **FR-M6.** The SDK's `session_id` is captured on `turn-start` / `turn-stop` and persisted on the session, so subsequent sends pass `resume: <sdkSessionId>` to chain context.
- **FR-M7.** **Token-by-token streaming (M6).** `chat.ts` passes `includePartialMessages: true` and forwards `stream_event` `content_block_delta` text deltas as `text-delta` events so the renderer can render the response token-by-token. The eventual full assistant message still arrives and rebuilds the canonical `blocks[]` for persistence, but its text-delta emit is suppressed when partial deltas streamed text already — preventing visible duplication.

### 4.6 Status bar

The status bar carries two controls: the **token meter** (left of the theme toggle) and the theme toggle.

- **FR-B1.** The token meter shows the active session's total tokens (in `K`/`M` form) and an estimated USD cost. Hidden when no session is active.
- **FR-B2.** Clicking the meter opens a **usage popover** with input / output / cache-write / cache-read rows, each showing tokens and an estimated cost based on the active session's model. The popover header lists the model tier and the per-1M input/output rates used for the estimate.
- **FR-B3.** Pricing is computed via `src/shared/pricing.ts` — a table keyed by model family (Opus / Sonnet / Haiku) with a Sonnet-tier fallback for unknown ids. Cache writes are billed at 1.25× input, cache reads at 0.1× input. The popover footer notes that values are estimates.
- **FR-B4.** The session's per-category running totals (`session.usage`) accumulate from each turn's `result.usage` (input/output/cache_creation/cache_read). The legacy `session.tokens` total is the sum.

### 4.7 New-session panel

- **FR-N1.** Right-anchored slide-in panel (440px) over a scrim, rendered via React Portal so it never affects the main grid layout. Animates `right: -460px → 0` (scrim fades).
- **FR-N2.** Session name field; auto-focused; auto-suggests `<folder> session` when blank.
- **FR-N3.** Working folder field (required, accent `*`); opens the OS-native directory picker. The branch is read from `.git/HEAD` and displayed as a chip.
- **FR-N4.** Model selection — a **listbox dropdown** (see FR-S7) showing every model the SDK exposes.
- **FR-N5.** "Custom instructions" — collapsible field showing the session's system prompt. Defaults to a standard coding-assistant prompt; editable later via the session context menu.
- **FR-N6.** Cancel + **Create session** (disabled until folder + name are present).

### 4.8 Settings & menus

- **FR-X1.** Settings popover (anchored off the gear in the activity bar): theme (light/dark), density (compact/cozy), palette preset (per current theme), accent preset, reading font, chat width, text size, composer style (panel / terminal), code theme (`Accent (built-in)` + 10 stock highlight.js themes), and global system prompt. (Extended in M6.)
- **FR-X2.** Session context menu (anchored off the sidebar item's kebab): Rename, Edit instructions, Close tab (if open), separator, Delete session (danger — soft-deletes to History).
- **FR-X3.** The 3-dot kebab on a sidebar row swaps in over the "last active" timestamp on hover so the two don't overlap. Clicking the kebab a second time closes the menu (the popover-close hook short-circuits the trigger).
- **FR-X4.** **History view** — the activity bar's clock icon opens a history list of soft-deleted sessions. Each row has a **Restore** button and a **trash** button (permanent delete with a confirm prompt). When the list is non-empty, a destructive **Delete all** button appears in the header next to the back-to-Sessions link; click confirms then purges every soft-deleted session in one DB statement (turns cascade). (M6.)
- **FR-X5.** **Tab cycling shortcuts.** `Ctrl+Tab` / `Ctrl+Shift+Tab`, `⌘+~`, `⌘+PgDn` / `⌘+PgUp`, `⌘+Shift+]` / `⌘+Shift+[` — all cycle through open tabs (forward / backward) with wraparound. (M6.)

### 4.9 Embedded terminal (M6)

- **FR-T5.** Each session pane has a `Chat / Terminal` switcher above the transcript area. The terminal renders a real PTY (`node-pty`) running the user's default shell in `session.path`, hosted in xterm.js.
- **FR-T6.** The terminal handle is drag-resizable; the height persists across sessions via the tweaks store.
- **FR-T7.** The transcript instance is preserved across the sub-tab toggle so scroll position survives.

### 4.10 Slash commands & plugins (M6)

- **FR-K1.** **Discovery.** Slash commands are discovered from four on-disk sources, in this priority order: (1) project `<cwd>/.claude/commands/*.md`, (2) user `~/.claude/commands/*.md`, (3) plugin `<plugin>/commands/*.md` namespaced as `<pluginName>:<cmd>`, (4) built-in `<app-resources>/commands/*.md` shipped with the installer. First match wins, so user files always override built-ins.
- **FR-K2.** **File format.** Each command is a Markdown file. Optional YAML frontmatter is scanned for `description:`. `$ARGUMENTS` in the body is replaced by whatever the user typed after the command name when the SDK invokes it.
- **FR-K3.** **Bundled defaults.** `resources/commands/` ships `security-review`, `explain`, `test`, `refactor`, `diff-review`, `commit`. These are packaged into installer builds via `electron-builder`'s `extraResources` so first-launch UX is non-empty.
- **FR-K4.** **Plugin loading.** Every directory under `~/.claude/plugins/*/` and `<cwd>/.claude/plugins/*/` containing a `.claude-plugin/plugin.json` manifest is passed to `sdkQuery({options:{plugins:[…]}})`. Plugin slash commands, skills, hooks, agents, and MCP servers all surface automatically; nothing app-side is needed per plugin.
- **FR-K5.** **Autocomplete UI.** When the composer's input starts with `/`, it switches to **skill mode** (accent border + `Slash command` chip) and shows a popover above the composer-box listing matching commands (name, description, scope badge). ↑/↓ navigates; Tab/Enter inserts the command text + trailing space. The popover hides when no matches or when the leading `/` is removed.

### 4.11 New-session branch / worktree (M6)

- **FR-N7.** Under the working-folder field, a three-way segmented control lets the user pick a git action to run before the session opens:
  - **Use current** — no-op; the session opens against whatever branch is checked out.
  - **New branch** — requires a name. Runs `git -C <path> switch -c <name>` in place.
  - **New worktree** — requires a name. Runs `git -C <path> worktree add <path>-<name> -b <name>`; the new sibling directory becomes the session's path. The resolved path is previewed inline before the user confirms.
- **FR-N8.** Git errors (path is not a repo, ref name invalid or taken, target directory exists, etc.) surface verbatim and abort session creation — no half-created sessions.
- **FR-N9.** `branchFor` reads the worktree's gitdir from `<path>/.git` when it's a file pointer rather than a directory, so the SessionHead branch chip is correct in worktrees too.

### 4.12 Plugin marketplace + sign-in flow (M6)

- **FR-P1.** A "Plugins" sidebar view (activity bar icon: chip outline) lists a curated set of community plugins. Each card shows name, author, description, tags, and an Install button. The list is hand-curated in `src/renderer/data/plugin-marketplace.ts`; adding an entry is a one-line change.
- **FR-P2.** Clicking **Install** shows a confirm modal with the exact `claude plugin install <id>` command. Confirming opens the embedded terminal sub-tab of the active session (creating a one-off "Plugin Install" session at `~` if there's none) and writes the command. The Claude CLI on the user's `PATH` handles the actual install.
- **FR-P3.** A **"Sign in to Claude"** action in Settings (and in the main placeholder when no session is selected) opens the embedded terminal with `claude login` queued. Creates a one-off "Claude Setup" session at `~` if there's no active session. This is the documented first-launch path for users whose SDK can't find existing credentials.
- **FR-P4.** Both flows use a `pendingTerminalCommand` field on the sessions store. The Terminal component pops it on PTY open and writes after 250ms so the user's shell prompt prints before our characters arrive.
- **FR-P5.** The Plugins view supports a text search (matches name / author / description / tags / installId) and tag-chip filters derived from the union of every plugin's tags. The sidebar count switches to `N/M` when filtered.
- **FR-P6.** The sessions store tracks a persisted `dispatchedInstalls: string[]` of plugin ids the user has confirmed at least once. Cards for those plugins show a "Dispatched" badge and flip their CTA to "Re-install". The state survives restarts via `partialize`.

### 4.13 External links (M6)

- **FR-E1.** Any "open in browser" action goes through `app.openExternal(url)` IPC. Main validates that the URL is `http:` or `https:` and ignores anything else (no `file://`, no `javascript:`, no custom schemes). The renderer never gets direct shell access.

### 4.14 Loaded skills view (M6)

- **FR-K6.** Tweaks panel has a "Loaded skills" section listing every Agent SDK skill currently armed for the active session. Read-only — the SDK invokes them autonomously based on the conversation. Same priority + scope rules as slash commands (project > user > plugin; no built-in scope since we don't ship any skills today).

### 4.15 Analytics view (M6)

- **FR-A1.** The activity bar's analytics icon opens a sidebar view showing total tokens and total estimated cost across **all** sessions (active + deleted).
- **FR-A2.** A time-range selector (24h / 7d / 30d / all) filters the totals. Per-turn `usage` is persisted in `turns.tokens_input / output / cache_w / cache_r` columns added during M6. Legacy turns without per-turn usage attribute to `session.lastActiveAt` so non-`all` ranges aren't deceptively empty for older sessions.
- **FR-A3.** A per-model breakdown lists each model's share of input / output / cache-write / cache-read tokens and the cost computed via `pricing.ts`.

### 4.16 Auto-update channel (M6)

- **FR-AU1.** Packaged builds run an auto-update check 10 seconds after launch and every 6 hours while open, using `electron-updater` against the project's GitHub Releases (configured via the `publish` block in `package.json`).
- **FR-AU2.** The main process exposes the updater state (`idle | checking | available | not-available | downloading | ready | error`) over IPC as `window.api.updater.{getState, check, install, onState}`. The renderer never imports `electron-updater` itself.
- **FR-AU3.** `UpdateBanner.tsx` floats above the status bar and is silent on idle / not-available / checking. It only renders for `available` / `downloading` / `ready` / `error`. The Restart CTA calls `quitAndInstall()`; Retry re-triggers a check.
- **FR-AU4.** `MS_DISABLE_AUTO_UPDATE=1` at launch turns the channel off entirely. Dev builds skip the check unconditionally.
- **FR-AU5.** The release workflow uploads `latest-mac.yml` / `latest.yml` metadata files alongside the installers so `electron-updater` can read them. Until installers are signed, downloaded updates still install via Gatekeeper / SmartScreen prompts.

## 5. Non-functional requirements

- **NFR-1. Native feel.** Frameless window, macOS traffic lights with `titleBarStyle: 'hiddenInset'`, custom title bar with the centered "Minimal Sessions" label.
- **NFR-2. High fidelity to the handoff.** Tokens (colors, radii, spacing, typography) are final per `design.md §4`. Compact density shrinks tool windows and turn gaps.
- **NFR-3. Performance.** Switching tabs is instant. Streaming does not block the UI thread (the SDK runs in the main process; events stream over IPC).
- **NFR-4. Auth & secrets.** The app does not handle the Anthropic API key directly. The Claude Agent SDK uses the user's existing Claude Code auth (OAuth subscription or `ANTHROPIC_API_KEY` env var). There is no in-app key entry, no `safeStorage`, no IPC method for keys.
- **NFR-5. Offline resilience.** Sessions and transcripts remain readable when offline; only sending new messages requires connectivity.
- **NFR-6. Accessibility.** All interactive elements are keyboard-reachable. Focus rings are inset (`outline-offset: -2px`) so they don't bleed into adjacent content. Full audit pending M5.
- **NFR-7. Cross-platform.** macOS is first class. Windows is the secondary target. Linux works but is best-effort.
- **NFR-8. ABI stability.** `predev` / `prebuild` hooks run `scripts/rebuild-native.mjs --runtime=electron` (downloads the prebuilt Electron-ABI binary via `prebuild-install`); the `pretest` hook does the same for the Node ABI via `npm rebuild`. `npm test` and `npm run dev` no longer flip-flop the native binding regardless of order.

## 6. Out of scope (v1)

- Multi-user / cloud sync.
- Sharing or exporting sessions beyond copying transcript text.
- Multi-folder sessions (one session = one folder).
- Plug-in / extension API.
- Voice input.
- Cost budgets / spending alerts.
- Full-text search across transcripts (sidebar search is sessions-only in v1).
- In-app API-key entry / management (replaced by the SDK's own auth — see NFR-4).
- Custom tool surface / sandbox (the SDK owns this — see FR-M4).

## 7. Success criteria

A v1 build is successful if a developer can:

1. Install the app on a machine where Claude Code is already authenticated, and immediately open a folder.
2. Start a real Claude session that reads files from that folder and answers a question about the code.
3. Open a second session in a different folder with a different model, switch between them as tabs without losing draft text or context.
4. Close and reopen the app and find both sessions exactly where they were, including ability to resume the Claude conversation thanks to the saved `sdkSessionId`.
5. Soft-delete a session, see it in **History**, then restore it (or permanently purge it).
