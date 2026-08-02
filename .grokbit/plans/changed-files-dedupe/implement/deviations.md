# Deviations — changed-files-dedupe

Where reality contradicted the plan. **At 3, stop and re-plan.**

## Waivers — recorded here, never counted

- Dirty tree on entry — 2026-08-01 — user invoked implement while tree had unrelated WIP. Snapshot limited to T1 start-of-task file copies under `implement/snapshots/` (not full `git stash -u`) so concurrent WIP was not buried. Risk: T1 commit must not silently swallow unrelated `media/chat.js` hunks without disclosure.
- Baseline — 2026-08-01 — captured in `test/baseline.md` via existing suite contracts + documented same-path pre-fix behavior from code inspection (no separate baseline commit required by repo convention of uncommitted local work).

## Count: 0 of 3
