# Preflight — tab-scroll-restore

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present, user.name/email set | true; Israel Richner; israel.richner@gamil.com | PASS |
| Dirty-tree snapshot | only if entry condition 2 dirty | Tree dirty with unrelated WIP; **no full stash** (would clobber multi-slug WIP). Proceeding dirty on explicit `/grokbit-implement this plan`. Task-scoped diffs only. Project CLAUDE.md: no auto-commit — commits deferred to user. | WAIVED dirty + commits |
| Runtime version | Node for vitest | v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile / node_modules | HAS_NODE_MODULES | PASS |
| Env vars | n/a for unit suite | none required | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | n/a | n/a | PASS |
| Clean suite | green | **1389 passed / 64 files** at preflight | PASS |

## Pre-existing test failures
None. Suite fully green before first edit.

Suite state at start: 1389 passed, 0 failed, 0 skipped

## Baseline
`test/baseline.md` exists (for other slug) and will be extended with tab-scroll behaviors under implement. Scroll-specific baseline recorded in progress notes: reveal always pins to bottom; live stick-to-bottom (#16) works only while webview lives.

## Blocked
- none
