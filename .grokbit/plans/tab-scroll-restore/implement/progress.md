# Progress — tab-scroll-restore

| Task | Status | Attempts | Commit | Created | Cost | Notes |
|---|---|---|---|---|---|---|
| T1 | done | 1 | deferred | `src/session-scroll.ts`, `test/session-scroll.test.ts` | — | Host memory + startSession reset + scrollState |
| T2 | done | 1 | deferred | none | — | clampScrollTop in webview-helpers |
| T3 | done | 1 | deferred | `test/tab-scroll-restore.dom.test.ts` | — | panelReplaying + restore + flush |
| T4 | done | 1 | deferred | `test/panel-replay-scroll.test.ts` | — | begin/finally/end wire + source-order test |
| T5 | done | 1 | deferred | none | — | full suite green |

Status: `pending` | `in-progress` | `done` | `blocked` | `skipped`

## Dependency verdicts
- none (no new packages)

## Notes
- Commits deferred: project never-auto-commit rule.
- Dirty tree: proceeded without stash (unrelated WIP).
