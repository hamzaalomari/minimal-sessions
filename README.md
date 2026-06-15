<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/minimal-sessions-wordmark-dark.svg" />
    <img src="src/renderer/assets/brand/minimal-sessions-wordmark.svg" alt="Minimal Sessions" width="296" />
  </picture>
</p>

# Minimal Sessions

A minimal desktop client for running multiple Claude coding sessions in parallel — each one pinned to a working folder on disk and a chosen model. Built on Electron with React and the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk); auth is reused from your local Claude Code install, so there's no API-key dance.

> **Not affiliated with Anthropic.** This is a hobby project — an independent third-party desktop wrapper that helps me (and hopefully you) run several Claude coding sessions side-by-side. "Claude", "Claude Code", and the Claude Agent SDK are products of [Anthropic](https://www.anthropic.com); this app simply talks to them.

## Download

Pre-built installers land on the [GitHub Releases page](https://github.com/hamzaalomari/minimal-sessions/releases) for every tagged version. The project currently ships **macOS (Apple Silicon) only** — grab the `…-arm64.dmg` file.

**Intel Macs:** there is no x64 installer today — GitHub's free macOS x64 runners are being deprecated and we don't cross-compile yet. Apple Silicon covers every Mac sold since 2020; if you're on Intel, build from source ([Build from source](#build-from-source) below). Same goes for Windows and Linux — `npm run dev` or `npm run package` from a local clone works.

The installer is **unsigned** while the project is in early access (an Apple Developer ID is a planned follow-up). On modern macOS, a downloaded unsigned DMG triggers the *"Minimal Sessions.dmg is damaged and can't be opened"* dialog. The DMG isn't actually damaged — that message is what Gatekeeper shows when there's no Developer ID signature on a file with the `com.apple.quarantine` attribute. Strip the attribute and the DMG mounts normally:

```bash
xattr -dr com.apple.quarantine ~/Downloads/Minimal.Sessions-0.1.1-arm64.dmg
```

Then double-click the DMG and drag the app to `Applications`. If macOS still complains when launching the installed app, run the same command against the `.app` bundle:

```bash
xattr -dr com.apple.quarantine "/Applications/Minimal Sessions.app"
```

You only have to do this once per machine.

## First launch — sign in to Claude

The app uses your local `claude` CLI's auth instead of asking for an API key. If you've already run `claude /login` somewhere else on this machine, you're good — open a session and start chatting.

If you haven't, the app has a built-in path:

1. Click the gear icon at the bottom of the left activity bar → **Sign in to Claude**, *or* on the "No session" placeholder click **Sign in to Claude** under "First time setting up?".
2. The embedded terminal opens, starts the `claude` REPL, and sends `/login` automatically.
3. Authorise in your browser when it pops open. You'll only need to do this once.

If `claude` isn't on your `PATH`, install it from <https://claude.com/claude-code> first.

## Features

### Sessions

- **Multi-session tabs.** Each tab is one Claude conversation, scoped to a working directory and a model. Tabs are drag-reorderable; `⌘1`–`⌘9` jumps to tab N.
- **Branch / worktree from the new-session panel.** Three-way segmented control: use the current branch, create a new branch (`git switch -c`), or carve a sibling worktree (`git worktree add`). Errors bubble up verbatim.
- **System prompts.** A global system prompt in Settings is concatenated with each session's own instructions and forwarded every turn. SessionHead shows a `system prompt` chip when one is set.
- **Soft delete + history.** Closed sessions move to **History** where you can restore or permanently delete them. The history view has a destructive "Delete all" button when there's history to clear.
- **Search.** `⌘F` opens a VSCode-style search that filters open and historical sessions by name or path.

### Conversations

- **Token-by-token streaming.** Responses stream in as the SDK emits `content_block_delta` events — not just on turn-stop.
- **Inline tool windows.** Read / edit / write / search / bash tool calls render as expandable cards in the transcript. Consecutive same-kind calls coalesce into one window with a paths list; Bash stays one-per-window with terminal styling.
- **Stop in flight.** A red stop button (or `Esc`) cancels the streaming turn instantly. The partial response is preserved and marked "Stopped."
- **Pasted-text collapsing.** Paste ≥15 lines or ≥1500 chars and the composer shows `[Pasted #N: K lines]`. The full text is sent at submit time.
- **Click-to-arm typing.** Click anywhere in the session pane and the next printable key lands in the composer — no visible focus jump, no cursor-mode wrangling.
- **Sticky-bottom autoscroll.** If you're at the bottom, streaming pins you there. If you've scrolled up to read, streaming doesn't yank you back.

### Embedded terminal

- **`⌘J` toggles a real PTY** rooted in the session's working directory. Backed by `node-pty` + xterm.js. Drag-resizable; persists its height across launches. The transcript instance is preserved across the chat/terminal toggle so scroll position survives.

### Slash commands

The composer detects `/`-prefixed input and shows an autocomplete popover with arrow-key navigation. Commands come from four sources, in priority order (first match wins):

1. **Project** — `<cwd>/.claude/commands/*.md`
2. **User** — `~/.claude/commands/*.md`
3. **Plugin** — bundled with installed SDK plugins, namespaced `pluginName:cmd`
4. **Built-in** — ships with the app: `security-review`, `explain`, `test`, `refactor`, `diff-review`, `commit`, `pr-description`, `migration`, `bench`, `release-notes`

### Plugin marketplace

- A curated **Plugins** sidebar view with one-click install for popular Claude Code plugins (Superpowers, awesome-claude-code, Claude Command Suite, Frontend Design, awesome-claude-plugins).
- Install runs `claude plugin install <id>` in the embedded terminal — needs the Claude CLI on your `PATH`.
- Text search + tag filters; cards you've already kicked off show a "Dispatched" badge so you can tell what you've tried.

### Skill discovery

Tweaks panel has a **Loaded skills** section listing every SDK skill currently armed for the active session, with scope badges (project / user / plugin). Skills are invoked autonomously by the SDK based on the conversation — this view exists so you know what's loaded.

### Analytics

A sidebar view showing total tokens + estimated cost across all sessions (active + deleted) with a 24h / 7d / 30d / all time-range selector and a per-model breakdown. Pricing comes from a table keyed by model family in `src/shared/pricing.ts`.

### Theme system

- Two-layer `data-theme` × `data-preset` palette: light / dark crossed with warm / paper / mist / classic / midnight / ocean / slate.
- Accent presets, density (cozy / compact), and a chat-width control.
- Composer style toggle (panel vs. terminal-prompt).
- Code-theme picker with 10 stock highlight.js themes.

### Auto-update

Packaged builds check GitHub Releases 10 seconds after launch and every 6 hours. A small banner above the status bar prompts a restart when an update is ready. Set `MS_DISABLE_AUTO_UPDATE=1` at launch to opt out. Settings has a manual **Check for updates** button and shows the current version.

## Keyboard shortcuts

`⌘/` (Ctrl+/ on Linux) opens the in-app cheatsheet — that's the source of truth. The greatest hits:

| Action | macOS | Linux |
|---|---|---|
| New session | `⌘N` | `Ctrl+N` |
| Close tab | `⌘W` | `Ctrl+W` |
| Jump to tab N | `⌘1`–`⌘9` | `Ctrl+1`–`Ctrl+9` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Toggle sidebar | `⌘B` | `Ctrl+B` |
| Toggle embedded terminal | `⌘J` | `Ctrl+J` |
| Settings | `⌘,` | `Ctrl+,` |
| Find session | `⌘F` | `Ctrl+F` |
| Navigate back / forward | `⌘⌥←` / `⌘⌥→` | `Ctrl+Alt+Left/Right` (or mouse buttons 4/5) |
| Show shortcuts | `⌘/` | `Ctrl+/` |
| Send / stop turn | `Enter` / `Esc` | `Enter` / `Esc` |

Aliases for tab cycling that also work: `⌘~`, `⌘PgUp` / `⌘PgDn`, `⌘⇧[` / `⌘⇧]` (Ctrl-prefixed on Linux).

## Build from source

### Prerequisites

- **Node.js 20+** (npm ships with Node). Check with `node -v`.
- **[Claude Code](https://claude.com/claude-code) installed and authenticated.** The Agent SDK reuses your local `claude` CLI session — there's no API key configured in the app.
- **macOS or Linux** with a desktop environment. The native modules (`better-sqlite3`, `node-pty`) need a C++ toolchain on first install — Xcode Command Line Tools on macOS, `build-essential` on Linux.
- **Git** for cloning.

### Install + run

```bash
git clone https://github.com/hamzaalomari/minimal-sessions.git
cd minimal-sessions
npm install
npm run dev
```

The dev script launches Electron with hot reload. First-run rebuilds `better-sqlite3` for the Electron runtime — that's one-time per Electron version. There's an ABI flip-flop fix wired into `predev` / `prebuild` / `pretest` hooks so `npm test` (Node ABI) and `npm run dev` (Electron ABI) don't fight each other.

### Build an installer

```bash
npm run package        # host platform
npm run package:mac    # .dmg + .zip — matches the host arch (arm64 on Apple Silicon, x64 on Intel)
```

Output lands in `dist/`. The macOS build uses the bundled `resources/icon.icns` (Apple icon-grid); other platforms fall back to `resources/icon.png`. CI (`.github/workflows/release.yml`) builds the arm64 mac DMG for each tag push; Intel mac and Linux installers must be self-built.

### Development scripts

```bash
npm test          # vitest — 399 tests
npm run typecheck # tsc --noEmit across main / web / test configs
npm run lint      # eslint
npm run build     # production bundle into out/ (no installer)
```

## Project layout

```
src/
├── main/       # Electron main process — SDK calls, SQLite, PTYs, IPC
├── preload/    # contextBridge surface exposed as window.api
├── renderer/   # React UI (Vite); components/, state/ (zustand), styles/
└── shared/     # types + utilities used across processes
resources/      # bundled assets — icon.png, icon.icns, commands/
specs/          # product spec, design notes, milestone plan
```

Architecture notes, design decisions, and the milestone tracker live in [`specs/`](./specs). Contribution conventions are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — copyright (c) 2026 Hamza Al-omari. Free to use, modify, and redistribute. Note that this project depends on the Claude Agent SDK and the Claude binary, which are governed by Anthropic's own terms.
