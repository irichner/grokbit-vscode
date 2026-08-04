---
name: grokbit-ship
description: Run the full Grokbit pipeline (explore → plan → human checkpoint → implement → test) with a mandatory pause after plan for approval.
---

# Grokbit — Ship (full pipeline)

Seeds a **full Grokbit pipeline** with a **human checkpoint after plan** (Ultimate `/ship` pattern). Does **not** reimplement accuracy protocol in the extension — it orchestrates suite skills and pauses for approval.

## Hard rules

1. **Pause after plan.** After `grokbit-plan` finishes a durable plan under `.grokbit/plans/<slug>/`, **stop and wait** for the user to approve (`[Plan approved]` / plan checkbox). Do **not** start implement until the human says so.
2. **Do not skip accuracy.** Implement still runs the full suite accuracy expectations (or project `/implement`); Ship is orchestration UX only.
3. **Agent budget.** Prefer a small number of delegated steps (~5 major phases). Do not spawn unbounded fan-out.
4. **COEXIST with phase tiles.** Explore / Plan / Implement / Test / Document remain available as separate Actions; Ship is the one-shot path.

## Pipeline

```
  1. grokbit-explore   (optional if user already scoped)
  2. grokbit-plan      → durable plan artifacts
  3. ★ HUMAN CHECKPOINT — wait for plan approval
  4. grokbit-test      (baseline, if plan tasks require baselines)
  5. grokbit-implement → verify-or-revert per task
  6. grokbit-test      (verify / SHIP readiness)
  7. grokbit-document  (when the user wants release notes / guide)
```

## Step 1 — Scope

Confirm the user goal in one short brief. If explore is useful, run `grokbit-explore` first (read-only). Otherwise go to plan.

## Step 2 — Plan

Invoke the **grokbit-plan** skill (or `/grokbit-plan`) for the brief. Produce durable artifacts under `.grokbit/plans/<slug>/`.

## Step 3 — Checkpoint (mandatory)

Tell the user clearly:

> Plan is ready at `.grokbit/plans/<slug>/plan.md`.  
> Reply **`[Plan approved]`** (or tick the approval checkbox and say approve) to continue to implement.  
> Reply **`[Plan rejected] …`** to revise.  
> **I will not implement until you approve.**

**End the turn here** unless approval is already in the same message.

## Step 4 — After approval only

1. Run baseline `grokbit-test` when the plan requires non-`none` baselines.
2. Run `grokbit-implement` against the approved plan.
3. Run `grokbit-test` in verify mode; surface SHIP / DO NOT SHIP honestly.
4. Optionally `grokbit-document` if the user asked for docs in the original brief.

## Failure modes

- **Skipping the checkpoint** — implementing immediately after plan. Always stop.
- **Soft-only "done"** — claiming ship-ready without test/verify evidence.
- **Rewriting accuracy into a mega-prompt** — point at suite skills; do not invent a second protocol.

## If workspace harness hooks are installed

Writing the plan artifacts counts as a file change, so the Stop gate runs Lint +
Unit tests before the Step 3 checkpoint can end the turn. Expect the pause to
arrive after a test run; that is the gate working, not a skipped checkpoint. Do
not disable the gate to reach the checkpoint faster.
