# Assumptions — <title>

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on — see `references/loops.md` for what
`UNVERIFIED` and `UNRESOLVED — <loop>` each mean and where they come from.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` <...>

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- `UNRESOLVED — Loop 2` <entity> — searched: <terms tried>

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- `UNRESOLVED — Loop 3` <finding> — last position: <architect's rebuttal, or
  "unresolved disagreement">

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist or the plan-level
Reviewer pass, if it reached the plan at all rather than being split or rewritten.

- `UNRESOLVED — Loop 4` <...>

## Resolution
Every item above is either resolved before the gate, carried into `plan.md`'s
`## Open assumptions` for the human to see, or explicitly waived at the gate.
An item that reaches implementation still unresolved is Implement's problem to
surface as a deviation, not to silently work around.
