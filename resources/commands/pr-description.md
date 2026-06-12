---
description: Draft a clear PR description from the current diff
---

Write a pull request description for the current branch.

Process:
1. Run `git diff <base-branch>...HEAD` to see what actually changed (the base branch is usually `main` or `master`).
2. Run `git log <base-branch>..HEAD --oneline` to see the commits.
3. Group the changes by intent — what the user/reader cares about — not by file. A refactor + a behavior change should be called out separately even if they share files.

Format:

```
## Summary
- One or two bullets focused on the why.
- Mention any user-visible behavior change.

## What changed
- Bullet list keyed by intent.

## Test plan
- [ ] Concrete steps a reviewer can run.
- [ ] Edge cases you actually verified.

## Risk / rollback
- Anything that could break in production, plus how to back it out.
```

Skip sections that don't apply (e.g. drop "Risk / rollback" for a docs-only change).

If $ARGUMENTS is provided, treat it as a short hint for the title and the top-line summary; otherwise propose both.
