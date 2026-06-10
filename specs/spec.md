# Spec — AI Work Viewer

> **Status (2026-06-11):** Implementation is past M4. The spec has been updated in place to match what shipped, with the original intent preserved. Items still pending for M5 are flagged inline.

## 1. Problem

Developers using Claude for coding work juggle multiple parallel investigations: one branch needs a bugfix, another needs a refactor, a third is exploring a new feature. Today they either run multiple terminal Claude Code sessions (no shared UI, hard to switch between) or open multiple browser tabs (no filesystem access, no per-folder scoping).

We need a single desktop-style app where each conversation is **scoped to a working folder on disk and a chosen model**, and where switching between conversations feels like switching tabs in an IDE.

## 2. Product summary

**AI Work Viewer** — a VS Code–style desktop app for browsing and running multiple Claude coding sessions in parallel. The user can:

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
- **FR-S8.** Each session has a **configurable system prompt** that is forwarded to the SDK on every send. The new-session panel exposes it as an expandable "Custom instructions" field with a sensible coding-assistant default. After creation, the user can edit it via the session context menu → "Edit instructions". Empty system prompt is allowed and means "no system prompt".

### 4.2 Tabs

- **FR-T1.** Selecting a session from the sidebar opens it as a tab (if not already open) and focuses it.
- **FR-T2.** Tabs are **closeable**; closing the active tab activates the previous remaining tab, or shows the "No session open" state.
- **FR-T3.** Tabs are **drag-reorderable** (HTML5 drag-and-drop).
- **FR-T4.** The window title is **"AI Work Viewer"** at all times; the active session name appears in the active tab and in the transcript header, not in the title bar.

### 4.3 Transcript

- **FR-R1.** A turn is `{ id, role: 'user' | 'assistant', blocks: Block[], modelShort?, createdAt }`.
- **FR-R2.** Block kinds supported: paragraph, heading, bulleted list, fenced code block (with language label), GFM-style table, tool line, expandable **tool window** with body, and inline error.
- **FR-R3.** Inline formatting in paragraphs and list items: `**bold**`, `*italic*`, and `` `inline code` ``.
- **FR-R4.** Code blocks have **light syntax highlighting** rendered as React nodes — never `innerHTML`.
- **FR-R5.** Transcript auto-scrolls to the bottom on new turns and during streaming.
- **FR-R6.** A typing indicator shows while the assistant has not yet started producing content.
- **FR-R7.** Empty session shows an empty-state card with the model name, folder path, and prefill suggestion chips.
- **FR-R8.** **Tool windows** render per `kind`:
  - `read` / `edit` / `write` / `search` — file paths in the header; consecutive same-kind tool calls are **coalesced** into one window with a `paths[]` list.
  - `bash` — terminal-style window with the command in the header and stdout/stderr in the body; never coalesced (each shell command is its own window). The live overlay shows the actual command while the model is still streaming, not a placeholder.

### 4.4 Composer

- **FR-C1.** Auto-growing textarea.
- **FR-C2.** **Enter** sends; **Shift+Enter** inserts a newline.
- **FR-C3.** Drafts are stored **per session** so switching tabs preserves unsent text.
- **FR-C4.** Send button disabled when empty or while a reply is pending.
- **FR-C5.** Composer shows the session's model as a chip and the working folder name in the placeholder.

### 4.5 Messaging (Claude integration)

- **FR-M1.** On send, append a user turn locally, then call `@anthropic-ai/claude-agent-sdk`'s `query()` from the main process. The SDK ships its own Claude binary and uses the device's existing Claude auth.
- **FR-M2.** **Stream** the assistant response into the transcript as the SDK emits `SDKMessage`s; the typing indicator stays until the first text/tool content arrives.
- **FR-M3.** Token usage per turn comes from the SDK's `result.usage` field (input + output tokens). The session's running `tokens` total updates on `turn-stop`.
- **FR-M4.** When the SDK reports **tool use** (read, write, edit, glob, grep, bash, etc.), each call renders as a tool window in the transcript and its result fills the window body. The tool surface is whatever the bundled Claude binary advertises — **including bash**. Sandboxing the tools is the SDK/binary's responsibility, not ours.
- **FR-M5.** Errors from the SDK (init failure, abort, non-success result) render as an inline error block in the transcript, not as a crash.
- **FR-M6.** The SDK's `session_id` is captured on `turn-start` / `turn-stop` and persisted on the session, so subsequent sends pass `resume: <sdkSessionId>` to chain context.

### 4.6 Status bar

The status bar is intentionally minimal in v1: it carries the theme toggle. The richer token meter + usage breakdown popover described in the original handoff is **deferred to M5+**.

### 4.7 New-session panel

- **FR-N1.** Right-anchored slide-in panel (440px) over a scrim, rendered via React Portal so it never affects the main grid layout. Animates `right: -460px → 0` (scrim fades).
- **FR-N2.** Session name field; auto-focused; auto-suggests `<folder> session` when blank.
- **FR-N3.** Working folder field (required, accent `*`); opens the OS-native directory picker. The branch is read from `.git/HEAD` and displayed as a chip.
- **FR-N4.** Model selection — a **listbox dropdown** (see FR-S7) showing every model the SDK exposes.
- **FR-N5.** "Custom instructions" — collapsible field showing the session's system prompt. Defaults to a standard coding-assistant prompt; editable later via the session context menu.
- **FR-N6.** Cancel + **Create session** (disabled until folder + name are present).

### 4.8 Settings & menus

- **FR-X1.** Settings popover (anchored off the gear in the activity bar): theme (light/dark) and density (compact/cozy) segmented controls.
- **FR-X2.** Session context menu (anchored off the sidebar item's kebab): Rename, Edit instructions, Close tab (if open), separator, Delete session (danger — soft-deletes to History).
- **FR-X3.** The 3-dot kebab on a sidebar row swaps in over the "last active" timestamp on hover so the two don't overlap. Clicking the kebab a second time closes the menu (the popover-close hook short-circuits the trigger).
- **FR-X4.** **History view** — the activity bar's clock icon opens a history list of soft-deleted sessions. Each row has a **Restore** button and a **trash** button (permanent delete with a confirm prompt).

## 5. Non-functional requirements

- **NFR-1. Native feel.** Frameless window, macOS traffic lights with `titleBarStyle: 'hiddenInset'`, custom title bar with the centered "AI Work Viewer" label.
- **NFR-2. High fidelity to the handoff.** Tokens (colors, radii, spacing, typography) are final per `design.md §4`. Compact density shrinks tool windows and turn gaps.
- **NFR-3. Performance.** Switching tabs is instant. Streaming does not block the UI thread (the SDK runs in the main process; events stream over IPC).
- **NFR-4. Auth & secrets.** The app does not handle the Anthropic API key directly. The Claude Agent SDK uses the user's existing Claude Code auth (OAuth subscription or `ANTHROPIC_API_KEY` env var). There is no in-app key entry, no `safeStorage`, no IPC method for keys.
- **NFR-5. Offline resilience.** Sessions and transcripts remain readable when offline; only sending new messages requires connectivity.
- **NFR-6. Accessibility.** All interactive elements are keyboard-reachable. Focus rings are inset (`outline-offset: -2px`) so they don't bleed into adjacent content. Full audit pending M5.
- **NFR-7. Cross-platform.** macOS is first class. Windows is the secondary target. Linux works but is best-effort.
- **NFR-8. ABI stability.** `predev` / `prebuild` npm hooks run `electron-rebuild -w better-sqlite3` so `npm test` (Node ABI) and `npm run dev` (Electron ABI) don't flip-flop the native binding.

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
