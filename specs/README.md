# Minimal Sessions — Speckit

This folder is the source of truth for what we're building, why, and in what order.

| Doc | What it answers |
|---|---|
| [`spec.md`](./spec.md) | What is this product, who is it for, what must it do? |
| [`design.md`](./design.md) | What does it look like, what are the components, what's the tech stack? |
| [`plan.md`](./plan.md) | In what order do we build it? What's in each milestone? |
| [`open-questions.md`](./open-questions.md) | Ambiguities from the handoff + pivots that surfaced during implementation. |

**Status (2026-06-13):** M0–M5 are merged on `master`. M6 (post-ship product depth — slash commands, plugin loading, embedded terminal, analytics, theme system, branch/worktree, perf, plugin marketplace, sign-in flow, skill discovery, auto-update) is fully landed apart from code signing. Remaining open items are itemised in `plan.md` under each milestone's punch list.

**Major in-flight pivot from the original spec:** Claude integration uses **`@anthropic-ai/claude-agent-sdk`** (which bundles its own Claude binary and reuses the device's existing Claude Code auth) instead of `@anthropic-ai/sdk` + in-app API key entry. See `open-questions.md` Q16 for the rationale and the downstream changes.
