# How Ship works

## Purpose
**Ship** runs the whole Grokbit pipeline end to end — explore, plan, **stop for your approval**, implement, test — so you get the full accuracy protocol without invoking five skills by hand. It is orchestration only: it does not reimplement any phase, and it cannot skip one.

The checkpoint is the reason it exists. An agent that plans and immediately implements gives you nothing to overrule; Ship makes the pause structural rather than a matter of the model remembering to ask.

## Pipeline

```
 Scope ──▶ Plan ──▶ ★ HUMAN CHECKPOINT ──▶ Baseline ──▶ Implement ──▶ Test ──▶ (Document)
 (brief)   (plan)     (you approve)         (test)      (implement)   (test)    (optional)
```

1. **Scope** — one short brief. Runs `grokbit-explore` first when the goal needs orientation; skips it when you have already scoped the work.
2. **Plan** — runs `grokbit-plan`, producing durable artifacts under `.grokbit/plans/<slug>/`.
3. **★ Checkpoint** — **stops and ends the turn.** Approve with `[Plan approved]` (or tick the approval box and say approve); revise with `[Plan rejected] …`.
4. **Baseline** — runs `grokbit-test` in baseline mode when any plan task declares a `baseline:` other than `none`, because a baseline captured after the first edit proves nothing.
5. **Implement** — runs `grokbit-implement`: verify-or-revert per task, one commit per task, scope audit on every diff.
6. **Test** — runs `grokbit-test` in verify mode and reports `SHIP` / `SHIP WITH CAVEATS` / `DO NOT SHIP` as evidence, not as a status line.
7. **Document** — only if you asked for docs in the original brief.

## Roles
Ship has none of its own. Each phase runs its own roster — Business Analyst, Systems Analyst, Solutions Architect and Plan Reviewer in Plan; Build Engineer, Software Engineer and Code Reviewer in Implement; QA Automation and Application Security Engineers in Test. Ship's job is the order and the pause between them.

## Loops and caps

| Bound | Value | On reaching it |
|---|---|---|
| Major delegated phases | ~5 | Deliberate ceiling — Ship is not unbounded fan-out |
| Every phase's own loops | Unchanged | Ship inherits them; it relaxes nothing |

## Cap behavior
Ship never softens a downstream gate. A blocked task stays blocked, three deviations still send the plan back to re-plan, and a `DO NOT SHIP` verdict is reported as it stands. Running the pipeline in one invocation changes the ergonomics, not the standards.

## Artifacts
Exactly what the individual phases write — `01-intent.md` through `plan.md`, then `implement/` and `test/` under the same slug. Ship adds no files of its own, so a Ship run and a hand-run pipeline leave an identical paper trail.

## Human gates
- **The checkpoint after plan is mandatory** and is the one thing Ship adds. It ends the turn; nothing implements until you reply.
- Plan's own question batch (at most three) still applies during Step 2.
- A `CRITICAL` security finding in Test blocks the release with no override.

## Coexists with the phase tiles
Explore, Plan, Implement, Test and Document remain separately available. Use Ship when you want the whole pipeline with one checkpoint; use the individual tiles when you want to drive each phase yourself, or to resume a pipeline midway.

## Failure modes
- **Skipping the checkpoint** — implementing straight after planning. Ship stops; if it ever does not, that is the bug.
- **Soft "done"** — claiming ship-ready without the Test verdict as evidence.
- **A second protocol** — Ship points at the suite skills; it must never grow its own competing rules.

## Next step
Approve or reject the plan at the checkpoint. After the run, `grokbit-document` is the usual follow-up when you want release notes or a guide.

## Provenance
Derived from `resources/skills/grokbit-ship/SKILL.md` and the suite skills it orchestrates. **Agent procedure remains `SKILL.md`.**
