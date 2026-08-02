# Deviations — <slug>

Where reality contradicted the plan. **At 3 counting (`counts: yes`) entries, stop and re-plan.**

## Waivers / non-counting — recorded here, never counted
Not numbered `D<n>`, not included in the Count line below. A waiver is a
risk the user consented to or a normal re-entry into the pipeline — not a
survey/shape contradiction.

- Baseline declined — <date> — user explicitly waived the baseline for
  `<task IDs>` (entry condition 4 in `SKILL.md`). Risk accepted, not a
  contradiction.
- Hand-back intake — <date> — task `T<n>` appended after a `grokbit-test`
  `DO NOT SHIP` verdict (`SKILL.md` § Step 7). Receiving the hand-back is
  not itself a deviation; a counting deviation the fix task goes on to
  trigger while it runs is recorded normally, below.
- Dependency rejected (I4) — record under numbered rows with `counts: no`
  if you want a paper trail, or here as a bullet; never treat two package
  rejections alone as “force full Survey re-run.”

## D1 — T2 — survey claim contradicted
counts: yes
Plan expected: `src/lib/auth.ts:42` exports `validateSession`
Actually found: file exports `checkSession`, different signature
Impact: T2 and T5 both assume the old name
Resolution: adapted in T2 / needs re-plan

## D2 — T3 — blocked at retry cap
counts: yes
Plan expected: <...>
Actually found: <...>
Impact: <...>
Resolution: <...>

## D3 — T4 — verify command could not execute (env)
counts: no
Plan expected: `rg` available on PATH
Actually found: `bash: rg: command not found` — this environment has no ripgrep
Impact: T4's verify never actually ran; the 3-attempt I2 cap was not charged
Resolution: rewrote verify to use `grep -r`, then re-ran — passed

---

Count (counts: yes only): 2 of 3
At 3 counting -> hand this file to grokbit-plan and rerun from Survey.
Completed tasks stay committed; remaining tasks get rebuilt on corrected ground.
Replan depth max 2 for this slug (see Loop I5).

## Replan boundary — <date>
Cap hit at D3. Survey + design re-run; superseded copies archived under `replan-1/`.
Cap resets to 0 for the corrected plan; numbering below continues, not restarts.

## D4 — <task> — <deviation after the replan>
Plan expected: <...>
Actually found: <...>
Impact: <...>
Resolution: <...>
