# Preflight — actions-workflow-tiles

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present, `user.name`/`user.email` set | repo on `main`; user.name=`Israel Richner`; user.email set | PASS |
| Dirty-tree snapshot | only if entry condition 2 was satisfied dirty | User asked to clean: stashed tracked WIP as `pre-implement clean for actions-workflow-tiles` (recover with `git stash list` / `git stash pop`). Tree now clean of tracked mods; only untracked `.grokbit/` (this plan) remains | PASS |
| Runtime version | Node present for vitest/tsc | Node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile / node_modules usable | suite ran without install; deps present | PASS |
| Env vars | none required for this plan | n/a | PASS |
| Ports free | n/a (extension unit tests) | n/a | PASS |
| Services up | none | n/a | PASS |
| Clean suite | existing tests green | **1338 passed**, 0 failed (58 files) | PASS |

Single-package repo — all tasks `cwd: none`.

## Baseline note (entry condition 4)

Tasks T2–T5 declare descriptive UI baselines in `plan.md` (current render behaviour), not a formal `test/baseline.md` for `grokbit-test`. Executable baseline for this phase is the green suite above. No formal baseline capture run; suite green is the regression floor.

## Pre-existing test failures

None. Suite state at start: **1338 passed, 0 failed, 0 skipped**.

## Blocked

None.
