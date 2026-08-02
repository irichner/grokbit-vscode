# Review log — Workflow click replaces prior seed in composer

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md` (re-read from disk after write; adversarial pass)

- `[MAJOR]` Free-text wipe on workflow click is assumed, not validated with the user — if they typed a long brief after clicking Plan then click Explore to “switch tools,” they lose the brief. — evidence: `01-intent.md` Assumptions; design Unhappy paths. — resolves by: keep as explicit gate assumption **or** tighten to Option C for “composer is only a lone slash seed.”
- `[MINOR]` Design lists two sub-shapes under A (mode flag vs set value in onclick). Implementer could diverge. — resolves by: pick one in `plan.md` as mandatory (mode flag + pass-through).
- `[MINOR]` Citation line numbers for `seedComposer` case may drift; behavior is real in `chat.js`. — resolves by: implementer re-greps if needed.
- No grounding failures on open files: `applyComposerSeed` append confirmed `media/webview-helpers.js:957-963`; capability click confirmed `media/chat.js:853-854`.
- Intent criteria cover panel and popover; design correctly notes shared `buildCapabilityRow`.
- Supersession table: append for workflow REPLACE, append for Docs LEAVE — complete vs survey.
- No reinvention: extends existing helper rather than a parallel seed API.
- No schema / deps.

### Architect response — Round 1
- `[MAJOR]` free-text wipe → **ACCEPTED as gate assumption** (not a design rewrite). Recorded in `assumptions.md` and Approval. If human rejects, switch task notes to Option C before implement.
- `[MINOR]` dual sub-shape → **REVISED in plan.md**: mandatory path is `applyComposerSeed` + `insertComposerPrompt` **replace mode**, not a one-off `input.value =` only in onclick.
- `[MINOR]` line drift → **REBUTTED**: implement re-opens files; not a plan defect.

## Round 2
Skipped — no remaining BLOCKER/MAJOR that requires design rewrite; open MAJOR is product assumption for human gate.

## Outcome
Rounds used: 1 of 3  
Outstanding at exit: free-text wipe policy as `UNVERIFIED` for human confirmation at gate (not a code design gap).

## Plan review (Loop 4)
Reviewed: `plan.md` (after Decompose)

- Verification matrix maps all done-criteria.
- Disposition summary matches design table.
- T1 verify proves replace + preserve append + no send.
- No BLOCKER.

Outcome: clean
