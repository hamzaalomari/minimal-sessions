# Contributing to Minimal Sessions

Thanks for your interest. This is a TypeScript + Electron + React desktop app — the kind of project where small details about the build matter. Read this once; you should be productive in 10 minutes.

## Prerequisites

- Node.js 20+ (LTS recommended) and npm 10+.
- Git.
- Platform toolchain for the bundled native modules (`better-sqlite3`, `node-pty`):
  - **macOS** — Xcode Command Line Tools (`xcode-select --install`).
  - **Windows** — `windows-build-tools` or Visual Studio Build Tools with the "Desktop development with C++" workload.
  - **Linux** — `build-essential`, `python3`.

Optional, but useful for end-to-end testing:

- The [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) authenticated locally — the Agent SDK reuses its credentials. If you don't have it, run **Settings → Sign in to Claude** from inside the app to bootstrap it via the embedded terminal.

## Getting started

```bash
git clone https://github.com/hamzaalomari/minimal-sessions.git
cd minimal-sessions
npm install
npm run dev          # launches the app with hot-reload
```

The first `npm install` rebuilds `better-sqlite3` and `node-pty` for Electron's ABI via `scripts/rebuild-native.mjs`. You should see two short rebuild blocks in the install output.

## Day-to-day

```bash
npm run dev          # development build + hot reload
npm test             # vitest, single-run
npm run lint         # eslint
npm run typecheck    # tsc --noEmit across main / renderer / tests
npm run build        # production build (electron-vite)
npm run package      # build + electron-builder for the host platform
npm run package:mac  # explicitly produce the macOS installer (.dmg + .zip)
npm run package:win  # explicitly produce the Windows installer (.nsis)
```

All four checks (`test`, `lint`, `typecheck`, `build`) should pass before you open a PR. CI runs them on every push.

### The ABI flip-flop

`better-sqlite3` ships a native binary compiled for a specific Node ABI. Electron ships its own (different) ABI. So if you switch between `npm test` (Node ABI) and `npm run dev` (Electron ABI) without rebuilding, you get a `NODE_MODULE_VERSION` error on the next launch.

We handle this automatically via npm script hooks:

- `predev` and `prebuild` → rebuild for Electron's ABI (via `prebuild-install`).
- `pretest` → rebuild for Node's ABI (via `npm rebuild better-sqlite3`).

If you ever see a `NODE_MODULE_VERSION` mismatch, just run the matching command again. If that fails, blow away `node_modules/better-sqlite3/build` and re-install.

## Project layout

```
src/
  main/         Node-side Electron — DB, SDK calls, git, IPC, PTY
  preload/      Typed bridge between main and renderer
  renderer/     React UI
  shared/       Types + utilities used by all three processes
test/           Vitest setup
specs/          Speckit: spec.md, design.md, plan.md, open-questions.md
resources/      Static assets bundled into the installer
  commands/     Built-in slash commands shipped with the app
  icon.png      App icon
```

The **speckit** in `specs/` is the source of truth for what we're building. Skim `plan.md` before starting work — the milestones explain why some bits look the way they do.

## Pull requests

- One concern per PR. Smaller is better.
- Include a "Test plan" section listing what you actually verified.
- Run the four checks locally (`test`, `lint`, `typecheck`, `build`) before pushing.
- If you change anything user-visible, add a one-line entry to `specs/plan.md` under the appropriate milestone.
- If you make a non-obvious decision, capture the rationale in `specs/open-questions.md`.

## Architecture notes worth knowing

- **No `nodeIntegration`.** The renderer talks to the main process only through the typed `window.api` exposed by `src/preload/index.ts`. New IPC: type in `src/shared/api.ts` → handler in `src/main/index.ts` → bridge entry in `src/preload/index.ts`.
- **SQLite is the source of truth** for sessions and turns. Renderer state (`openIds`, `activeId`, `drafts`) is persisted to `localStorage` via Zustand's `persist` middleware. Don't add tabletop state to localStorage that belongs in SQLite.
- **The Agent SDK owns auth and tools.** Don't reach for `@anthropic-ai/sdk` or build a sandbox. See `specs/open-questions.md` Q16 for why.
- **Slash commands are files, not code.** Drop a markdown file in `resources/commands/` to add a built-in. See [`docs/slash-commands.md`](specs/spec.md) §4.10 for the priority order and file format.
- **The transcript subtree is memoized.** `Transcript`, `Turn`, `Block`, `CodeBlock` are all `React.memo` with `useMemo` around `parseMarkdown` and `highlightNodes`. Don't unwrap them — they're load-bearing for typing performance.

## Releases

Production releases require code signing certs we don't have CI for yet (Apple Developer ID and Windows Authenticode). Until then, local `npm run package` produces unsigned installers — fine for development testing, not for handing to other people. Tracking in `specs/plan.md` M5 punch list.

## Questions

Open a discussion or issue. If it's a decision that affects future contributors, it should land in `specs/open-questions.md` once resolved.
