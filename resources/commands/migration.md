---
description: Write a database (or other) migration with up/down logic
---

Write a migration for $ARGUMENTS.

Process:
1. Detect the migration framework already in use (Alembic, Knex, Prisma, Rails, Django, raw SQL, etc.) by scanning the repo. Match its conventions and put new files in the right location.
2. Read the current schema (model file, `schema.sql`, the existing migrations folder) before writing — never propose changes blind.
3. Write both directions if the framework supports it. **Up** is the new state; **down** must restore the prior state, or be explicitly marked irreversible with a one-line reason.

Things to think about even if the user didn't ask:

- **Locking.** Will this migration take a lock that blocks writes? For Postgres, prefer `ADD COLUMN ... NULL` + backfill + `SET NOT NULL` over a single `ADD COLUMN NOT NULL DEFAULT`.
- **Backfill.** If a new NOT NULL column needs values for existing rows, write the backfill explicitly.
- **Indexes.** New indexes on large tables should usually be `CONCURRENTLY` (Postgres) or its equivalent.
- **FK + cascades.** Confirm cascade behavior matches existing conventions.
- **Application compatibility.** Will running app instances tolerate this schema mid-deploy?

End with a short "Deploy notes" block listing anything the operator needs to know (estimated lock time, prerequisite app version, etc.).
