# Spec — Claude Session Viewer

## 1. Problem

Developers using Claude for coding work juggle multiple parallel investigations: one branch needs a bugfix, another needs a refactor, a third is exploring a new feature. Today they either run multiple terminal Claude Code sessions (no shared UI, hard to switch between) or open multiple browser tabs (no filesystem access, no per-folder scoping).

We need a single desktop-style app where each conversation is **scoped to a working folder on disk and a chosen model**, and where switching between conversations feels like switching tabs in an IDE.

## 2. Product summary

A VS Code–style interface for browsing and running multiple Claude coding sessions. The user can:

- See all sessions in a left sidebar (model, folder path, message count, last active).
- Open sessions as named, drag-reorderable tabs across the top.
- Start a new session via a slide-in panel: name it, pick a working folder, pick a model.
- Read the conversation as a clean document-style transcript with code blocks and tool/file-edit lines.
- Send messages via a composer with per-session draft preservation.
- Track context/token usage in the status bar, with a breakdown popover.
- Toggle light/dark, rename and delete sessions.

## 3. Users & primary scenarios

**Primary user**: a working software engineer who already uses Claude (API or Claude Code) for day-to-day coding.

**Scenarios:**

1. **Parallel investigations.** I'm debugging an auth issue in `auth-service` while also drafting a marketing copy rewrite in `marketing-site`. I want to flip between them as tabs without losing context.
2. **Pick the right model per job.** Opus for the gnarly debugging, Haiku for the quick copy edits. Each session remembers its model.
3. **Scope to a real folder.** When I say "look at the middleware," Claude should be reading files from the folder I picked, not guessing.
4. **Keep history.** Sessions persist across app restarts so I can come back to yesterday's debugging trail.

## 4. Functional requirements

### 4.1 Sessions

- **FR-S1.** A session is `{ id, name, path, model, systemPrompt, branch, createdAt, lastActiveAt, tokens, turns[] }`.
- **FR-S2.** The user can **create** a session by providing a name (optional — auto-suggested from folder), a working folder (required), a model (any current Claude model — see FR-S7), and an optional system prompt (see FR-S8).
- **FR-S3.** The user can **rename** a session inline in the sidebar (Enter commits, Escape/blur cancels).
- **FR-S4.** The user can **delete** a session — removes it from the list and closes its tab.
- **FR-S5.** Sessions **persist** across app restarts (list, transcripts, drafts, tokens, system prompt).
- **FR-S6.** Each session displays its current **git branch** for the working folder (read from `.git/HEAD`); blank if not a git repo.
- **FR-S7.** The model picker exposes **every Claude model the API offers**, grouped by family (Opus, Sonnet, Haiku) and ordered newest-first within each family. Each row shows the model ID (e.g. `claude-opus-4-7`), the family color dot, and a one-line tier descriptor. The currently-recommended default is preselected.
- **FR-S8.** Each session has a **configurable system prompt** that is sent on every API call. The new-session panel exposes it as an expandable "Custom instructions" field with a sensible default (a coding-assistant prompt scoped to the session's folder). After creation, the user can edit it via the session context menu → "Edit instructions". Empty system prompt is allowed and means "no system prompt".

### 4.2 Tabs

- **FR-T1.** Selecting a session from the sidebar opens it as a tab (if not already open) and focuses it.
- **FR-T2.** Tabs are **closeable**; closing the active tab activates the previous remaining tab, or shows the "No session open" state.
- **FR-T3.** Tabs are **drag-reorderable** (HTML5 drag-and-drop).
- **FR-T4.** The active session name appears in the window title bar.

### 4.3 Transcript

- **FR-R1.** A turn is `{ id, role: 'user' | 'assistant', blocks: Block[] }`.
- **FR-R2.** Blocks supported: paragraph, subhead, bulleted list, fenced code block (with language label), tool line (read/edit/write/search), and expandable **tool window** with body (code or diff). `run` is intentionally not in the kind set (see FR-M4).
- **FR-R3.** Inline formatting: `**bold**` and `` `inline code` `` parse in paragraphs and list items.
- **FR-R4.** Code blocks have **light syntax highlighting** (keywords, strings, comments) rendered as React nodes — never `innerHTML`.
- **FR-R5.** Transcript auto-scrolls to the bottom on new turns and during typing.
- **FR-R6.** A typing indicator (3 blinking dots) shows while awaiting an assistant reply.
- **FR-R7.** Empty session shows an empty-state card with the model name, folder path, and three prefill suggestion chips.

### 4.4 Composer

- **FR-C1.** Auto-growing textarea (24px → max 180px).
- **FR-C2.** **Enter** sends; **Shift+Enter** inserts a newline.
- **FR-C3.** Drafts are stored **per session** so switching tabs preserves unsent text.
- **FR-C4.** Send button disabled when empty or while a reply is pending.
- **FR-C5.** Composer shows the session's model as a chip and the working folder name in the placeholder.

### 4.5 Messaging (Claude integration)

- **FR-M1.** On send, append a user turn locally, then call the Claude API with the full session history.
- **FR-M2.** **Stream** the assistant response token-by-token into the transcript; the typing indicator stays until the stream starts producing content.
- **FR-M3.** Token usage per turn comes from the API response's usage data — not heuristics. The session's running `tokens` total updates after each turn.
- **FR-M4.** When Claude requests **tool use** (read file / write file / list directory / search), the tool runs against the session's working folder via a sandboxed filesystem layer, and the result is fed back to Claude. Each tool call renders as a tool window in the transcript. **Shell command execution is intentionally not offered** — the v1 tool surface is read/write/list/search only.
- **FR-M5.** Errors from the API (rate limits, network, auth) render as an inline error block in the transcript, not as a crash.

### 4.6 Status bar

- **FR-B1.** Left: git branch + working folder path of the active session.
- **FR-B2.** Right: model (color dot + full name), token meter, theme toggle.
- **FR-B3.** Token meter is a 78×5 bar; fill width = `used / 200_000 × 100%`; color shifts: accent (default), warn `#e0a32e` >65%, hot `#dd6b55` >85%.
- **FR-B4.** Clicking the meter opens a **usage breakdown popover** (system, files, conversation, free; estimated cost).

### 4.7 New-session panel

- **FR-N1.** Right-anchored slide-in (440px) over a scrim. Animations: scrim fade 0.18s, panel slide 0.26s.
- **FR-N2.** Session name field; auto-focused; auto-suggests `<folder> session` when blank.
- **FR-N3.** Working folder field (required, accent `*`); opens the OS-native directory picker.
- **FR-N4.** Model selection — a scrollable list of **every Claude model the API offers**, grouped by family (Opus / Sonnet / Haiku). Each row: family color dot + model ID + tier label + one-line description + radio. The list is collapsible: by default it shows the recommended model per family (3 rows); a "Show all models" toggle expands to every version. Pre-selected default is the current Sonnet.
- **FR-N5.** "Custom instructions" — collapsible field (`<details>`-style) showing the session's system prompt. Defaults to the standard coding-assistant prompt; the user can clear or replace it. Editable later via the session context menu.
- **FR-N6.** Cancel + **Create session** (disabled until folder + name are present).

### 4.8 Settings & menus

- **FR-X1.** Settings popover (anchored off the gear in the activity bar): theme (light/dark) and density (compact/cozy) segmented controls.
- **FR-X2.** Session context menu (anchored off the sidebar item's kebab): Rename, Edit instructions, Copy transcript, Close tab (if open), separator, Delete session (danger).

## 5. Non-functional requirements

- **NFR-1. Native feel.** The app shell must look and feel like a desktop IDE, including macOS traffic-light dots, custom title bar, and a 28px status bar.
- **NFR-2. High fidelity to the handoff.** Tokens (colors, radii, spacing, typography) are final per `design.md §4`. No improvisation on the design system.
- **NFR-3. Performance.** Switching tabs is instant. Transcript with 200 turns scrolls at 60fps. Streaming does not block the UI thread.
- **NFR-4. Security.** Filesystem access is scoped to the session's working folder; Claude tools cannot read or write outside it. **No shell command execution** is exposed to the model — the tool surface is read/write/list/search only. The Anthropic API key is stored in the OS keychain, never in plaintext on disk or in renderer process memory.
- **NFR-5. Offline resilience.** Sessions and transcripts must remain readable when offline; only sending new messages should require connectivity.
- **NFR-6. Accessibility.** All interactive elements are keyboard-reachable. Tab order is logical. Focus rings are visible (the design already specifies accent focus rings).
- **NFR-7. Cross-platform.** macOS and Windows are first class. Linux works but is best-effort.

## 6. Out of scope (v1)

- Multi-user / cloud sync.
- Sharing or exporting sessions (beyond "Copy transcript" via the context menu).
- **Shell command execution as a Claude tool** (see FR-M4 / NFR-4).
- Multi-folder sessions (one session = one folder).
- Plug-in / extension API.
- Voice input.
- Cost budgets / spending alerts beyond the per-session estimate.
- Full-text search across transcripts (sidebar search is sessions-only in v1).

## 7. Success criteria

A v1 build is successful if a developer can:

1. Install the app, paste in an Anthropic API key, and open a folder.
2. Start a real Claude session that reads files from that folder and answers a question about the code.
3. Open a second session in a different folder with a different model, switch between them as tabs without losing draft text or context.
4. Close and reopen the app and find both sessions exactly where they were.
