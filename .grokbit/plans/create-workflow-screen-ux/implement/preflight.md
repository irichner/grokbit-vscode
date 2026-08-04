# Preflight — create-workflow-screen-ux

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present | `git rev-parse` true; dirty tree (unrelated plans + metrics) | PASS — user approved while dirty |
| Dirty-tree snapshot | restore at handoff if stashed | **No stash** — unrelated dirty files left in place; implement only touches plan-listed files; CLAUDE.md forbids commit-per-task outside rebuild | PASS with note |
| Runtime version | Node for vitest | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile / node_modules | tests run | PASS |
| Env vars | none required for unit tests | n/a | PASS |
| Ports free | n/a | n/a | PASS |
| Services up | n/a (no real grok in npm test) | n/a | PASS |
| Targeted suite | green before edit | `webview-helpers` + `capabilities.dom` 272 passed (2026-08-03) | PASS |

## Pre-existing test failures

None observed in targeted suite.

Suite state at start (targeted): 272 passed, 0 failed.

## Project policy notes

- **Commit-per-task overridden** by `CLAUDE.md` (“Do not commit or push outside the rebuild/release paths”). Changes left uncommitted for user rebuild path.
- Baseline: recorded in `test/baseline.md` from live tests + source (characterization via existing tests, not separate committed baseline suite).

## Blocked

none
