---
description: Stage relevant changes and write a clear commit message
---

Create a git commit for the current uncommitted work.

Process:
1. Run `git status` and `git diff` to see what's changed.
2. Run `git log -5 --oneline` to match the project's commit style.
3. Group changes into one commit (or multiple, if they're genuinely independent — but prefer one).
4. Write a commit message that focuses on *why*, not just *what* — the diff already shows what.
5. Skip files that look like secrets or local-only state (`.env`, credentials, `.DS_Store`, etc.).

Show the user the proposed message and which files will be staged, then wait for confirmation before running the commit. If $ARGUMENTS is provided, use it as a hint for the commit subject.
