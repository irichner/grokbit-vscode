# Preflight — collapsible-user-prompt

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present, user.name/email set | true; Israel Richner / israel.richner@gamil.com | PASS |
| Dirty-tree snapshot | if dirty: stash or WIP | **Dirty tree present** (user WIP: chat.js/css/helpers + other plans). User invoked `/grokbit-implement this plan` → proceed dirty. **No full stash** (would conflict on same files). Snapshot: none | PASS (waiver) |
| Runtime version | Node for npm test | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile usable | suite runs | PASS |
| Env vars | none required for unit suite | n/a | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | none | n/a | PASS |
| Clean suite | green before edits | **1516 passed**, 73 files | PASS |

## Pre-existing test failures

None. Suite state at start: **1516 passed**, 0 failed, 0 skipped.

## Baseline

Written to `test/baseline.md` (plan-local) from live suite + code characterization before T2/T3 writes.

## Blocked

None.
