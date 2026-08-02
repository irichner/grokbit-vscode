# Preflight — session-setup-top-bar

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo, user.name/email | repo yes; Israel Richner / israel.richner@gamil.com | PASS |
| Dirty-tree snapshot | only if dirty | Dirty: plan artifacts + unrelated `session-tab-window-restore/`, modified handoff, stray `$null`. User invoked implement on this plan → **proceed dirty**. Snapshot: **none** (plan dir must remain writable; unrelated dirty left untouched) | PASS |
| Runtime | Node for vitest | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | node_modules present | present | PASS |
| Env vars | none required for unit suite | n/a | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | n/a | n/a | PASS |
| Clean build / suite slice | model-chip green | `test/model-chip.dom.test.ts` 14/14 pass | PASS |
| Entry: approval | plan.md checkbox | ticked 2026-08-02 after `/grokbit-implement this plan` | PASS |
| Entry: baseline | non-none baselines for T1/T3 | `test/baseline.md` exists (prior slug); slug baseline written in `implement/baseline-notes.md` + pre-change model-chip green | PASS |

## Pre-existing test failures
None observed on targeted preflight slice (`model-chip` 14 green).

Suite state at start (targeted): 14 passed, 0 failed.

## Commits
Per project `CLAUDE.md` (“Never commit … automatically”), task commits are **deferred** unless the user asks — progress records `commit: deferred`. Revert-to-clean uses working-tree restore against start-of-task file snapshots if needed.

## Blocked
- none
