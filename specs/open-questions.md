# Open Questions

Items the handoff left ambiguous. Resolved questions are marked **Resolved** and a one-line note points at where the decision now lives in `spec.md` / `design.md` / `plan.md`.

## Product

- **Q1. System prompt.** ✅ **Resolved.** Configurable per session. Default = a coding-assistant prompt scoped to the folder; editable from the new-session panel and via "Edit instructions" in the session context menu. See `spec.md` FR-S8, FR-N5, FR-X2; `design.md` state model + IPC.

- **Q2. Which Claude models ship?** ✅ **Resolved.** All Claude models the API exposes are selectable. The new-session model picker is grouped by family (Opus / Sonnet / Haiku), collapsed to the recommended model per family by default, with a "Show all models" toggle. See `spec.md` FR-S7, FR-N4; `design.md` `<ModelPicker>`, `api.models.list()`.

- **Q3. Tool use scope.** ✅ **Resolved.** **No shell command execution.** The v1 tool surface is `read_file` / `write_file` / `list_dir` / `search` only. The `run` tool-window kind is removed. See `spec.md` FR-M4, NFR-4, §6; `design.md` Block union, `<ToolWindow>` row, IPC note.

- **Q4. Cost meter accuracy.** ✅ **Resolved (default accepted).** Per-tier pricing table (input vs. output), computed from real `usage` deltas. Hard-coded `$0.012/1K` is gone.

- **Q5. Search in the activity bar.** ✅ **Resolved (default accepted).** Searches sessions by name / path / last message preview. Full-text transcript search is out of scope for v1 (see `spec.md` §6).

## Design

- **Q6. Windows title bar.** ✅ **Resolved (default accepted).** Stock min/max/close on the right; same centered active-session-name treatment.

- **Q7. Linux support.** ✅ **Resolved (default accepted).** No Linux installers in v1. README documents `npm run build` for users who want to run from source.

- **Q8. Composer placeholder for non-git folders.** ✅ **Resolved (default accepted).** Same `Message Claude about <folder>…` placeholder; the status bar already handles the no-branch case.

## Engineering

- **Q9. SQLite vs. JSON.** ✅ **Resolved.** SQLite (`better-sqlite3`). Revisit if turn counts stay tiny.

- **Q10. Tool-runner sandbox technique.** ✅ **Resolved (default accepted).** `realpath` + `startsWith` against the session's working folder (also resolved via `realpath` once at session creation).

- **Q11. Streaming back-pressure.** ✅ **Resolved (default accepted).** Buffer text-deltas in ~50ms coalescing batches before sending the IPC message.

- **Q12. Multi-window support.** ✅ **Resolved (default accepted).** Single window in v1.

- **Q13. Copy transcript to clipboard.** ✅ **Resolved (default accepted).** Yes — surfaced as a context-menu item on the sidebar. Added to FR-X2.

## Process

- **Q14. CI.** ✅ **Resolved (default accepted).** Minimal lint+typecheck workflow in M0, full build matrix in M5.

- **Q15. Telemetry.** ✅ **Resolved (default accepted).** No telemetry in v1. README states this explicitly.

---

**All v1 open questions are now resolved.** New questions surfaced during implementation should be added below and resolved before merging the affected milestone.
