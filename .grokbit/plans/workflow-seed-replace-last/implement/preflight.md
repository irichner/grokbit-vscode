# Preflight — workflow-seed-replace-last

Run before the first task. Record observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present | repo on `main`, git works | PASS |
| Dirty-tree snapshot | only if dirty | Tree dirty with unrelated WIP (`actions-survive-agent-switch` on `chat.js`/`capabilities.dom.test.ts`, metrics, package.json). **No stash** — user-approved implement on ongoing tree; stashing would entangle unrelated work. Revert-to-clean for T1 limited to T1 hunks only if needed. | PASS (proceed dirty, snapshot: none) |
| Runtime version | Node for vitest | Node v22.20.0 | PASS |
| Deps installed | lockfile usable | `npm test` runs | PASS |
| Env vars | n/a for webview unit tests | — | PASS |
| Ports free | n/a | — | PASS |
| Services up | n/a | — | PASS |
| Targeted baseline | studio + capabilities green | 80 tests passed before T1 edits | PASS |

## Pre-existing test failures
None in the T1 verify set.

Suite state at start (targeted): 80 passed, 0 failed

## Blocked
- none

## Baseline note
Plan `baseline:` references existing test behavior, not a full `test/baseline.md` suite capture. Treated as satisfied by pre-change green targeted run (Studio append + first capability click). No separate `grokbit-test` baseline mode run.
