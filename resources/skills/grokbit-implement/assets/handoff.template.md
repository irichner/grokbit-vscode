# Implement handoff — <slug>

Input contract for `grokbit-test` verify mode. Not the same file as the
top-level `.grokbit/handoff.md` (SKILL.md § Step 6) — that one is a
cross-session summary for a future `grokbit-plan` invocation; this one is
scoped to this slug and read only by Test.

## Completed
- T1 `a3f9c21` — <intent>
- T2 `7b1e004` — <intent>

## Blocked
- T3 — <why> — done-criteria affected: <which>

## Surface changed
Files: `path/a.ts`, `path/b.tsx`
Endpoints added/changed: `POST /api/reset`
Schema changes: <migration name> | none
UI views affected: `/settings`, `/login`
Dependencies added: `date-fns@3.6.0`

## Look here hard
Areas where verification effort is best spent, and why.

- <e.g. shared `formatDate` helper was modified — used in 7 places per survey>

## Deviations
See `deviations.md` — N recorded.

## Baseline reference
Captured: `test/baseline.md`  | NOT CAPTURED — regression claims will be limited
