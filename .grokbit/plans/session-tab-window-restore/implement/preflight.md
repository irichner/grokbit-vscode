# Preflight — session-tab-window-restore

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present | true, `main...origin/main` | PASS |
| Dirty-tree snapshot | if dirty | Dirty: modified `.grokbit/handoff.md`, untracked other plans; **no stash** (proceed dirty per prior project implement sessions; revert-to-clean limited to task file lists) | PASS (accepted dirty) |
| Runtime version | Node for npm test | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile usable | `npm test` subset runs | PASS |
| Env vars | n/a for extension unit tests | n/a | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | n/a | n/a | PASS |
| Clean build | suite smoke | `test/panel-router.test.ts` 11/11 green | PASS |

## Pre-existing test failures
None observed in smoke subset. Full suite not run at preflight (will run T5).

Suite state at start: smoke green; full suite deferred to T5.

## Blocked
- none

## Project commit policy
CLAUDE.md: never commit without explicit user request. Task commits deferred (same as prior implement sessions). Rollback via `git checkout` of task files if needed.
