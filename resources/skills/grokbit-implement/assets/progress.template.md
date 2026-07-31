# Progress — <slug>

The session's memory. Update after every task. If the process dies, this is
the only thing that knows where it was.

`Created` is the files this task added that did not exist before — distinct
from files it merely modified. Revert-to-clean deletes these; `git checkout`
alone only restores tracked files, so a task that skips this column leaves
exactly the debris the phase exists to prevent if it's later reverted.

| Task | Status | Attempts | Commit | Created | Cost | Notes |
|---|---|---|---|---|---|---|
| T1 | done | 1 | `a3f9c21` | `src/auth/reset-form.tsx` | $0.12 | — |
| T2 | done | 2 | `7b1e004` | none | $0.48 | verify flaked on first run |
| T3 | blocked | 3 | — | `src/auth/reset-token-v2.ts` (deleted on revert) | $0.91 | see diagnoses below |
| T4 | pending | — | — | — | — | depends T3 |

Status: `pending` | `in-progress` | `done` | `blocked` | `skipped`

## Blocked task detail

### T3 — <title>
Attempt 1 diagnosis: <what the output actually showed> → change made → result
Attempt 2 diagnosis: <...> → result
Attempt 3 diagnosis: <...> → result
Reverted (revert to clean): deleted `<created files>`; `git checkout <modified files>`
Recommendation: <re-plan | needs human decision | needs missing capability>

## Dependency verdicts
- `APPROVE date-fns@3.6.0 — 8M weekly, MIT, 12kb, no in-repo equivalent`
- `REJECT moment — unmaintained — instead: date-fns (approved above)`
