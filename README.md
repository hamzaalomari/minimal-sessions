# Minimal Sessions

A minimal desktop client for running multiple Claude coding sessions in parallel — each one pinned to a working folder on disk and a chosen model. Built on Electron with React and the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk); auth is reused from your local Claude Code install, so there's no API-key dance.

## Features

- **Multi-session tabs.** Each tab is one Claude conversation, scoped to a working directory and a model. Branch is read from `.git/HEAD` and shown as a chip.
- **Inline tool windows.** Read / edit / write / search / bash tool calls render as expandable cards in the transcript. Consecutive same-kind calls coalesce into one window with a paths list; Bash stays one-per-window with terminal styling.
- **Stop in flight.** A red stop button in the composer cancels the streaming turn instantly (or press `Esc`). The partial response is preserved and marked "Stopped.".
- **Token + cost meter.** Per-session running tally of input / output / cache-create / cache-read tokens with `$/1M` pricing per model. Click to see the breakdown.
- **Search.** `⌘F` opens a VSCode-style search view that filters open and historical sessions by name or path. Open matches first, history below.
- **History view.** Soft-delete a session, restore it from history, or purge it permanently. Nothing is lost by accident.
- **Tweaks panel.** Theme (light / dark), reading font (sans / serif / mono — JetBrains Mono), and a global system prompt that's prepended to every session's own instructions. Per-session instructions live on the session.
- **Keyboard shortcuts.** `⌘N` new session · `⌘W` close tab · `⌘\` toggle sidebar · `⌘1`–`⌘9` jump to tab N · `⌘,` settings · `⌘F` search.
- **Local-first persistence.** All sessions, turns, and usage are persisted to SQLite via the Electron main process. The only network call is the SDK's own to Claude.

## Install

Requires **Node 20+** and a working [Claude Code](https://claude.com/claude-code) install (the Agent SDK reuses its auth).

```bash
git clone https://github.com/hamzaalomari/minimal-sessions.git
cd minimal-sessions
npm install
npm run dev
```

The dev script launches Electron with hot reload. First-run rebuilds `better-sqlite3` for the Electron runtime — that's one-time per Electron version.

## Build an installer

```bash
npm run package        # host platform
npm run package:mac    # .dmg + .zip (arm64 or x64, matches the host arch)
npm run package:win    # NSIS .exe (run on a Windows host or via CI)
```

Output lands in `dist/`. Builds are **unsigned by default** — production releases need an Apple Developer ID (mac) and an Authenticode cert (Windows). App icons are TODO; the default Electron icon ships for now.

## Development

```bash
npm test          # vitest, ~350 tests
npm run typecheck # tsc --noEmit across main / web / test configs
npm run lint      # eslint
npm run build     # production bundle into out/ (no installer)
```

Spec, design, and milestone tracking live in [`specs/`](./specs).

## License

[MIT](./LICENSE) — copyright (c) 2026 Hamza Al-omari. Free to use, modify, and redistribute. Note that this project depends on the Claude Agent SDK and the Claude binary, which are governed by Anthropic's own terms.
