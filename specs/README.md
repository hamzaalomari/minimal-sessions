# Claude Session Viewer — Speckit

This folder is the source of truth for what we're building, why, and in what order. It is derived from the design handoff in `Claude session viewers.zip` (kept out of the repo; see `design.md` for the relevant excerpts).

| Doc | What it answers |
|---|---|
| [`spec.md`](./spec.md) | What is this product, who is it for, what must it do? |
| [`design.md`](./design.md) | What does it look like, what are the components, what's the tech stack? |
| [`plan.md`](./plan.md) | In what order do we build it? What's in each milestone? |
| [`open-questions.md`](./open-questions.md) | What did the handoff leave ambiguous? What do we need to decide before coding? |

**Status:** spec only — no application code has been written yet. Implementation begins after this spec is merged.

**Source design:** the handoff is a React + Babel in-browser prototype showing the intended look and behavior. It is a reference, not production code. We recreate the design in a real build with real integrations.
