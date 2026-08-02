# Preflight — <slug>

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present, `user.name`/`user.email` set | not a repo | FIXED — ran `git init` + initial commit |
| Dirty-tree snapshot | only if entry condition 2 was satisfied dirty; **must be restored at Step 6 handoff** | `git stash push -u -m "pre-implement snapshot <slug>"` (record exact message) \| WIP commit `<sha>` \| tree was clean, none needed | FIXED |
| Runtime version | `.nvmrc` 20.x | 20.11.0 | PASS |
| Deps installed | lockfile in sync | drift detected | FIXED — ran install |
| Env vars | `.env.example` parity | `STRIPE_KEY` missing | BLOCKED |
| Ports free | 3000, 5432 | 3000 in use (pid 4412) | FIXED |
| Services up | postgres | reachable | PASS |
| Clean build | succeeds | succeeds | PASS |

If this repo is a monorepo (more than one `package.json`/lockfile/runtime),
the table above covers only the root — add one row per package that a task's
`cwd:` will point into.

## Pre-existing test failures
These were already red BEFORE any change. They are NOT regressions.
Testing compares against this list.

- `auth.spec.ts > refresh token rotation` — failing on main
- <...>

Suite state at start: N passed, N failed, N skipped | no test suite configured

## Blocked
- <check> — needs: <human decision>
