# Preflight — workflow-how-they-work

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present | `git rev-parse` → true | PASS |
| Dirty-tree snapshot | dirty tree at start (unrelated WIP) | Proceed dirty per user approve; **no stash** (would tangle unrelated WIP) | WAIVED — restore n/a |
| Runtime version | Node for vitest | v22.20.0 | PASS |
| Deps installed | node_modules present | vitest runs | PASS |
| Env vars | n/a for this change | — | PASS |
| Ports free | n/a | — | PASS |
| Services up | n/a | — | PASS |
| Clean suite | npm test green | **1410 passed** (2026-08-01 preflight) | PASS |

## Pre-existing test failures
None — suite green at start.

Suite state at start: 1410 passed, 0 failed

## Blocked
- none

## Notes
- CLAUDE.md: no auto-commit; task commits deferred (record `deferred` in progress).
- T4 baseline: characterized by existing `test/capabilities.dom.test.ts` invoke/openFile behavior; see `test/baseline.md`.
