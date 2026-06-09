# Open Questions

Items the handoff left ambiguous or that need a product call before implementation. Resolved questions get moved to the relevant section of `spec.md` or `design.md`.

## Product

- **Q1. System prompt.** The handoff says nothing about Claude's system prompt. Do we hard-code a coding-focused system prompt (e.g. "You are a coding assistant working in the folder `{path}`. You can read files, edit files, and run commands…") or expose it per-session in v1? **Default proposal:** hard-coded in v1, configurable in a later release.

- **Q2. Which Claude models exactly?** The handoff names "Claude Opus 4.6", "Claude Sonnet 4.6", "Claude Haiku 4.6". The actual model IDs we ship with depend on what's available at build time (e.g. `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`). **Default proposal:** ship with the latest available IDs per tier, store the tier (opus/sonnet/haiku) per session rather than the exact ID, and resolve to the current ID at send time.

- **Q3. Tool use scope.** Should v1 include `run_command` (shell execution against the working folder)? It's powerful but risky — a misbehaving model could break things. **Default proposal:** include it, but gate every command behind a one-click user approval the first time per session; remember approval per session.

- **Q4. Cost meter accuracy.** The handoff hard-codes `$0.012 / 1K tokens`. Real pricing differs per model and per input/output. **Default proposal:** maintain a small pricing table per model tier (input vs. output) and compute the estimate from real `usage` deltas.

- **Q5. Search in the activity bar.** The handoff shows a Search icon but marks it `no-op in mock`. What should it search — sessions by name, or full-text across transcripts? **Default proposal:** scope to sessions (name + path + last message preview) in v1. Defer full-text transcript search.

## Design

- **Q6. Windows title bar.** The handoff specifies macOS traffic lights but is silent on Windows. **Default proposal:** Windows gets stock minimize/maximize/close on the right, with the same centered active-session-name treatment.

- **Q7. Linux support.** Listed as best-effort in `spec.md`. Do we ship a `.AppImage` / `.deb`? **Default proposal:** no installers for v1; document `npm run build` for users who want to run from source.

- **Q8. Empty composer placeholder for non-git folders.** The handoff's placeholder is `Message Claude about <folder>…`. What does this read like when the folder isn't a git repo? **Default proposal:** same placeholder — the status bar already handles the no-branch case.

## Engineering

- **Q9. SQLite vs. JSON.** We picked SQLite. For very small installations (< 5 sessions), a JSON file would have been simpler. Worth revisiting if anyone pushes back. **Status:** decided in `design.md §1`; revisit if turn counts stay tiny.

- **Q10. Tool runner sandbox technique.** We say "reject any path that resolves outside the working folder." Do we use `path.resolve` + `startsWith` (simple, works for symlinks of files inside) or a stricter `realpath` check (rejects symlinks pointing outside)? **Default proposal:** `realpath` + `startsWith` for safety. Edge case: a working folder that itself contains symlinks — handle by resolving the working folder's `realpath` once at session creation.

- **Q11. Streaming back-pressure.** If the renderer is slow (say, during a giant code block), do we drop streaming events or buffer? **Default proposal:** buffer with a coalescing strategy — accumulate text-deltas into ~50ms batches before sending the IPC message.

- **Q12. Multi-window support.** Should one app instance allow multiple windows (each its own session set)? **Default proposal:** single window in v1; revisit if users ask.

- **Q13. Session export.** Listed as out-of-scope in `spec.md §6`, but is "Copy transcript to clipboard" in v1? **Default proposal:** yes, as a context-menu item on the sidebar — cheap to add and frequently asked for.

## Process

- **Q14. CI.** Do we set up GitHub Actions in M0 or M5? **Default proposal:** a minimal lint+typecheck workflow in M0, full build matrix in M5.

- **Q15. Telemetry.** Do we send anonymous usage to anywhere? **Default proposal:** no telemetry in v1. Be explicit about this in the README so it's a feature, not an oversight.
