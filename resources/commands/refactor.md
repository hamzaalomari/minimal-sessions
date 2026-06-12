---
description: Refactor code without changing behavior — propose, then apply
---

Refactor $ARGUMENTS (or the code under discussion). Focus on:

- Naming that reads more clearly to a new reader.
- Reducing nesting and early-return where it helps.
- Pulling out helpers only when they're reused or genuinely clarify a long function — don't over-extract.
- Removing dead branches, redundant checks, and "just-in-case" defensive code that can't actually trigger.
- Replacing repeated logic with the existing utility if one already exists in this codebase.

**Hard constraints:**
- Behavior must be identical. No new features, no removed behavior, no API changes unless the user asked.
- Run the test suite after refactoring. If anything fails, fix it before reporting done.
- Don't introduce a new abstraction layer for a single caller.

Before editing, summarise the refactor in 3–5 bullets so the user can redirect if it's the wrong shape.
