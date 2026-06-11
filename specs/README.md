# Minimal Sessions — Speckit

This folder is the source of truth for what we're building, why, and in what order.

| Doc | What it answers |
|---|---|
| [`spec.md`](./spec.md) | What is this product, who is it for, what must it do? |
| [`design.md`](./design.md) | What does it look like, what are the components, what's the tech stack? |
| [`plan.md`](./plan.md) | In what order do we build it? What's in each milestone? |
| [`open-questions.md`](./open-questions.md) | Ambiguities from the handoff + pivots that surfaced during implementation. |

**Status (2026-06-11):** M0–M4 are merged on `master`. M5 (packaging, fonts, keyboard shortcuts, accessibility audit, usage popover) is pending.

**Major in-flight pivot from the original spec:** Claude integration uses **`@anthropic-ai/claude-agent-sdk`** (which bundles its own Claude binary and reuses the device's existing Claude Code auth) instead of `@anthropic-ai/sdk` + in-app API key entry. See `open-questions.md` Q16 for the rationale and the downstream changes.
