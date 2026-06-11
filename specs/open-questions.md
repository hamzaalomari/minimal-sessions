# Open Questions

Items the handoff left ambiguous, plus pivots that surfaced during implementation. Resolved questions note where the decision now lives in `spec.md` / `design.md` / `plan.md`.

## Product

- **Q1. System prompt.** ✅ **Resolved.** Configurable per session. Default = a coding-assistant prompt scoped to the folder; editable from the new-session panel and via "Edit instructions" in the session context menu. See `spec.md` FR-S8, FR-N5, FR-X2.

- **Q2. Which Claude models ship?** ✅ **Resolved (with M4 pivot).** All models the locally-installed Claude SDK advertises via `Query.supportedModels()` are selectable. The picker is a `/model`-style listbox dropdown (replacing the originally-specced grouped Opus/Sonnet/Haiku cards). See `spec.md` FR-S7, FR-N4; `design.md` `<ModelPicker>`.

- **Q3. Tool use scope.** ⚠️ **Reversed during M4.** The original answer was "no shell command execution; v1 tool surface is read/write/list/search only." When we switched to the Agent SDK (Q16), the bundled Claude binary owns its own tool surface, which **includes bash**. The renderer now has a `bash` `ToolKind` with a terminal-styled window. See `spec.md` FR-M4, FR-R8; `design.md` `<ToolWindow>`.

- **Q4. Cost meter accuracy.** ✅ **Resolved (M5).** Status bar gained a `<TokenMeter>` pill and `<UsagePopover>` with per-category breakdown (input / output / cache-write / cache-read). Pricing lives in `src/shared/pricing.ts`: Opus $15/$75, Sonnet $3/$15, Haiku $1/$5 per 1M tokens; cache writes at 1.25× input, cache reads at 0.1×. The popover footer flags values as estimates. The renderer falls back to Sonnet pricing for any unknown model id rather than silently zeroing.

- **Q5. Search in the activity bar.** ⏳ **Stubbed.** The button is in the activity bar but doesn't do anything yet. Full-text transcript search remains out of scope.

## Design

- **Q6. Windows title bar.** ✅ **Resolved (default accepted).** Stock min/max/close on the right via `titleBarOverlay`; centered "AI Work Viewer" label.

- **Q7. Linux support.** ✅ **Resolved (default accepted).** No Linux installers in v1.

- **Q8. Composer placeholder for non-git folders.** ✅ **Resolved (default accepted).** Same `Message Claude about <folder>…` placeholder.

## Engineering

- **Q9. SQLite vs. JSON.** ✅ **Resolved.** SQLite (`better-sqlite3`). Schema in `app.getPath('userData')/sessions.db`. Migrations are idempotent (`PRAGMA table_info` + conditional `ALTER`) so the `sdk_session_id` and `deleted_at` columns added during M4 land cleanly on older DBs.

- **Q10. Tool-runner sandbox technique.** ⚠️ **Obsolete after Q16.** We no longer run a custom tool runner. The Agent SDK's bundled Claude binary owns sandboxing.

- **Q11. Streaming back-pressure.** ✅ **Resolved (default accepted).** SDK messages are translated to `ChatEvent`s and forwarded over IPC without explicit coalescing — the SDK's chunk size is already practical.

- **Q12. Multi-window support.** ✅ **Resolved (default accepted).** Single window in v1.

- **Q13. Copy transcript to clipboard.** ⏳ **Deferred.** Not in the v1 context menu (Rename / Edit instructions / Close tab / Delete only). Add back in M5 if cheap.

## Process

- **Q14. CI.** ✅ **Resolved (default accepted).** Lint + typecheck + Vitest run in CI. Lint config has `AbortController`, `Promise`, `globalThis` in `nodeGlobals` so the M4 code passes.

- **Q15. Telemetry.** ✅ **Resolved (default accepted).** No telemetry.

---

## Questions that surfaced during implementation

- **Q16. Anthropic SDK choice — first-party SDK vs. Agent SDK.** ✅ **Resolved during M4.** Switched from `@anthropic-ai/sdk` (with first-run API-key entry + `safeStorage`) to `@anthropic-ai/claude-agent-sdk`.
  - **Why:** the user already has Claude Code installed and authenticated on their machine. Asking them to paste an API key again is friction. The Agent SDK reuses the device's existing Claude auth (OAuth subscription or `ANTHROPIC_API_KEY` env var), ships its own bundled Claude binary, and provides its own tool surface and sandboxing — so we shed all of: key-entry UI, `safeStorage` IPC, the custom sandboxed tool runner, and the per-tool wiring.
  - **Trade-off:** we lose direct control over the tool surface (the bundled binary decides), and we depend on the user's Claude setup being healthy.
  - **What changed:** `spec.md` NFR-4 rewritten; `design.md` tech stack + IPC surface updated; `plan.md` M4 rewritten with the pivot called out; `spec.md` FR-M4 / FR-R8 / `Block` union extended for `bash`.

- **Q17. SDK model list completeness.** ⏳ **Open.** `Query.supportedModels()` returns 3 entries on our test machine (Opus 4.6, Sonnet 4.6, Haiku 4.5) while the `/model` CLI command displays more. Unclear whether this is a subscription/license filter, a bundled-binary limit, or our call shape is wrong. The picker has fallback to `LOCAL_MODELS` and a debug log line (`[models] supportedModels returned N entries: ...`) in main, but we haven't confirmed the root cause yet. Tracking: surface the SDK's true return list, then decide whether to spawn the bundled `claude` binary with different flags or hard-code the presets.

- **Q18. History view lifetime.** ✅ **Resolved (default accepted).** Soft-deleted sessions live in History forever until the user clicks the trash icon (with confirm). No automatic purge. Reconsider if the table grows uncomfortably.

- **Q19. Window title — session name vs. product name.** ✅ **Resolved.** Constant "AI Work Viewer". The active session name lives in the tab and the transcript header. Avoids the OS-level title flicker on every tab switch.

- **Q20. ABI flip-flop between Node and Electron.** ✅ **Resolved (M5 rewrite).** First pass used `@electron/rebuild` in `predev` / `prebuild` hooks, but its `.forge-meta` cache marker treated stale state as authoritative — if the `.node` file was missing or wrong-ABI but the marker matched, the rebuild silently no-op'd and the next `npm run dev` crashed with `NODE_MODULE_VERSION`. Replaced with `scripts/rebuild-native.mjs` which calls `prebuild-install` directly for Electron and delegates to `npm rebuild better-sqlite3` for Node (so its `prebuild-install || node-gyp rebuild` fallback handles patch versions without a published prebuild). `pretest` was also added so test runs auto-restore Node ABI. `@electron/rebuild` removed from dependencies.

- **Q21. New session panel layout shift.** ✅ **Resolved.** Initial implementation animated the panel with `transform: translateX`, which momentarily extended the grid past the viewport and shifted the main pane sideways. Final fix: `createPortal(document.body)` + animate `right: -460px → 0` so the panel is never part of the main grid.

- **Q22. Popover close-on-trigger toggling.** ✅ **Resolved.** `usePopoverClose` takes a `triggerEl` and ignores mousedowns on it, so the same click that opens a popover doesn't immediately close it (and a second click on the trigger toggles closed instead of re-opening).

---

New questions surfaced during further implementation should be added below and resolved before merging the affected change.
