# Deviations — <slug>

Where reality contradicted the plan. **At 3, stop and re-plan.**

## Waivers — recorded here, never counted
Not numbered `D<n>`, not included in the Count line below. A waiver is a
risk the user consented to or a normal re-entry into the pipeline — not a
contradiction of the plan.

- Baseline declined — <date> — user explicitly waived the baseline for
  `<task IDs>` (entry condition 4 in `SKILL.md`). Risk accepted, not a
  contradiction.
- Hand-back intake — <date> — task `T<n>` appended after a `grokbit-test`
  `DO NOT SHIP` verdict (`SKILL.md` § Step 7). Receiving the hand-back is
  not itself a deviation; a deviation the fix task goes on to trigger while
  it runs is recorded normally, below, like any other task's.

## D1 — T2 — survey claim contradicted
Plan expected: `src/lib/auth.ts:42` exports `validateSession`
Actually found: file exports `checkSession`, different signature
Impact: T2 and T5 both assume the old name
Resolution: adapted in T2 / needs re-plan

## D2 — T3 — blocked at retry cap
Plan expected: <...>
Actually found: <...>
Impact: <...>
Resolution: <...>

## D3 — T4 — verify command could not execute
Plan expected: `rg` available on PATH
Actually found: `bash: rg: command not found` — this environment has no ripgrep
Impact: T4's verify never actually ran; the 3-attempt cap was not charged for this
Resolution: rewrote verify to use `grep -r`, then re-ran — passed

---

Count: 3 of 3
At 3 -> hand this file to grokbit-plan and rerun from Survey.
Completed tasks stay committed; remaining tasks get rebuilt on corrected ground.

## Replan boundary — <date>
Cap hit at D3. Survey + design re-run; superseded copies archived under `replan-1/`.
Cap resets to 0 for the corrected plan; numbering below continues, not restarts.

## D4 — <task> — <deviation after the replan>
Plan expected: <...>
Actually found: <...>
Impact: <...>
Resolution: <...>
