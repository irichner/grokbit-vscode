---
name: commit-conventions
description: How commits are written in this repo — Conventional Commits, one logical change per commit, imperative subject, a body that explains why. Apply whenever creating a commit or splitting work into commits. This is a background standard.
user-invocable: false
---

# Commit conventions

## Format (Conventional Commits)
```
<type>(<optional scope>): <imperative subject, <=72 chars, no trailing period>

<body: what changed and WHY — wrap ~72 cols. The diff shows how; the body
explains the reasoning, the alternative rejected, and any consequence.>

<optional footer: BREAKING CHANGE: ...  /  Refs: #123  /  Closes #123>
```

## Types
- **feat** — a new capability for users.
- **fix** — a bug fix.
- **refactor** — behavior-preserving structure change.
- **perf** — a change that improves performance.
- **test** — adding or correcting tests only.
- **docs** — documentation only.
- **build** / **ci** — build system, dependencies, or CI config.
- **chore** — maintenance that doesn't touch src or tests.

## Rules
- **One logical change per commit.** If the subject needs "and", it's probably two
  commits. Split unrelated changes apart.
- **Imperative mood**: "add", "fix", "remove" — not "added" or "fixes". Reads as
  "this commit will <subject>".
- **Subject is specific**: `fix(auth): reject expired refresh tokens` beats
  `fix: bug`.
- **Explain the why in the body** for anything non-obvious. Future-you reads commit
  messages during incidents.
- **Mark breaking changes** with a `BREAKING CHANGE:` footer (or `!` after the type:
  `feat!:`).
- **Don't commit** secrets, generated artifacts, commented-out code, or debug output.
- **Green before commit**: don't commit code that fails the project's checks.

## Examples
```
feat(parser): support trailing commas in config files

Users hit syntax errors when their editor auto-added trailing commas.
Accept and ignore them to match the behavior of the surrounding ecosystem.

Closes #214
```
```
fix(cache): prevent stale reads after concurrent invalidation

invalidate() cleared the map after notifying readers, so a reader between
the two steps could repopulate a stale entry. Clear before notifying.
```
