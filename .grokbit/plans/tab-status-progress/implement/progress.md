# Progress — tab-status-progress

The session's memory. Update after every task.

| Task | Status | Attempts | Commit | Created | Cost | Notes |
|---|---|---|---|---|---|---|
| T1 | done | 1 | deferred (project no auto-commit) | none | — | pure title status/progress + tests; 101 tests green |
| T2 | done | 1 | deferred | none | — | Session turnToolIds; setStatus/toolCall/markRead → updateTabTitle |
| T3 | skipped | — | — | — | — | optional icons; title cues meet done-criteria — skip per plan |

Status: `pending` | `in-progress` | `done` | `blocked` | `skipped`

## Blocked task detail
(none)

## Dependency verdicts
- none (no new packages)

## Assumptions resolved
- Glyph set `… ? * !` locked as designed; Windows smoke deferred to user rebuild
- Step-count = v1 progress bar — implemented as `…N` on working tabs
