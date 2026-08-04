# Assumptions — Raise plan/implement accuracy

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` “These changes” = operationalize Coverage+Lint + dual-pipeline clarity from explore map.
- `UNVERIFIED` Lint = `npx tsc -p . --noEmit` without ESLint.
- `UNVERIFIED` Coverage provider = `@vitest/coverage-v8`.
- `UNVERIFIED` Dual-pipeline work is docs-only (no UI).
- `UNVERIFIED` Whole-package coverage may be &lt;80%; v1 measures without fail_under by default.

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- (none that block the plan — suite skill copies under `resources/skills/` not fully opened; dual-pipeline content lives in `docs/grokbit-workflows.md` + template skills already cited.)

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- (none — Round 1 MAJORs resolved into design/task shape.)

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist.

- `UNRESOLVED — Loop 4` Exact current whole-package coverage % is unknown until T2 runs (cannot invent). Task verify records the number; does not require ≥80% for ship of measurement tooling.

## Resolution
- Intake UNVERIFIED items: accept at gate or override (e.g. demand ESLint).
- Coverage %: resolve during T2; if ≥80% and owner wants fail_under, optional follow-up task — not required for done-criteria.
- Build TODO row: LEAVE (not in done-criteria).
