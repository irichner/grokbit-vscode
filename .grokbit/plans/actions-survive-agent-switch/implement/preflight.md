# Preflight — actions-survive-agent-switch

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present | repo on `main`; dirty: plan handoff + new plan dir only | PASS |
| Dirty-tree snapshot | tree dirty with plan artifacts only | no stash — plan files only; code files clean before edit | none needed (user-approved dirty plan tree) |
| Runtime version | Node for vitest | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile works | `npm test` runnable | PASS |
| Env vars | n/a for this change | n/a | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | n/a | n/a | PASS |
| Clean suite at start | green preferred | not re-run pre-edit; full suite green post-change (1419) | PASS post |

## Pre-existing test failures
None observed for this change path.

Suite state at end of implement: 1419 passed, 0 failed.

## Blocked
None.

## Notes
- Project rule: never auto-commit — commits deferred despite implement “commit per task.”
- T1 baseline described the bug under fix, not preserve-behavior; no `test/baseline.md` (waiver in deviations).
