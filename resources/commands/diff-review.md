---
description: Review the current git diff like a thoughtful reviewer would
---

Review the current uncommitted (or PR) diff. If $ARGUMENTS names a branch/PR, review that instead; otherwise use `git diff` against the project's main branch.

Look for, in priority order:

1. **Correctness bugs** — off-by-one, null/undefined paths, race conditions, missed error cases, broken invariants. Cite file:line.
2. **Test gaps** — behaviour that changed but has no test, or tests that don't actually exercise the new branch.
3. **Hidden side effects** — touching shared state, ordering dependencies, hooks/middleware that fire on more events than the author expected.
4. **Reuse and simplification** — anywhere the same problem is solved twice, or where existing helpers were missed.
5. **Naming, comments, and documentation** — only flag if a future reader would actually be confused.

Skip nits about style the linter already covers. Don't pad the review — if a section has nothing, just say so. End with a clear "ready to merge" / "needs another pass" recommendation and the top 1–3 blocking items.
