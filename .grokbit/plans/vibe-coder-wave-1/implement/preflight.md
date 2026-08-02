# Preflight — vibe-coder-wave-1

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo, user.name/email | true; Israel Richner; email set | PASS |
| Dirty-tree snapshot | if dirty | **dirty** (large unrelated WIP: paste, workflows, session-setup, …). **No stash** — would remove mid-turn/paste base T3 builds on and risk clobbering user WIP. Same pattern as phase-a preflight. | PASS (proceed dirty) |
| Commit-per-task | skill default | **waived** — project CLAUDE.md forbids auto-commit; leave uncommitted for user | WAIVED |
| Runtime | Node for vitest | node v22.20.0, npm 10.9.3 | PASS |
| Deps | vitest present | vitest ok | PASS |
| Env / ports / services | N/A for unit suite | N/A | PASS |
| Preflight suite sample | permission-bind green | 21 passed | PASS |

## Pre-existing test failures

None observed on `test/permission-bind.test.ts` (21 passed). Full suite deferred to T6 baseline (tree already has unrelated WIP).

Suite state at start (sampled): permission-bind 21/21 green.

## Blocked

- none
