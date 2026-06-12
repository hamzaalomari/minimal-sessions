---
description: Draft release notes from the commit log between two refs
---

Write user-facing release notes for $ARGUMENTS (or the range since the last tagged release if empty).

Process:
1. Identify the range. If $ARGUMENTS names two refs (`v1.2.0..HEAD`, `main..release-1.3`), use them. Otherwise default to `<latest tag>..HEAD`; if there's no tag, ask the user.
2. Read the commits with `git log <range> --pretty=format:"%h %s" --no-merges` and group them by intent.

Format:

```
## Highlights
- The 2–4 changes a user actually cares about, in order of impact.

## New
- New features, behind feature flags noted explicitly.

## Improvements
- Performance, polish, accessibility.

## Fixes
- Bug fixes worth calling out.

## Internal
- Refactors / dependency bumps. One bullet is fine.

## Breaking changes
- Migrations, config changes, removed APIs. Include the upgrade step.
```

Voice: terse, user-focused, no "we". Talk about *what* changed and *why it matters*, not *who* did it. Skip sections that have no entries.

Skip nits the user doesn't care about (formatting fixes, internal renames) unless they affect public APIs.
