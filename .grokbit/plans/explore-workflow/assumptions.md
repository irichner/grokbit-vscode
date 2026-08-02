# Assumptions — Explore workflow in Grokbit Actions

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` Skill basename is `grokbit-explore`.
- `UNVERIFIED` Explore may be run mid-session without forcing Plan; it is taught first, not a hard gate.
- `UNVERIFIED` Chat map only — no required on-disk explore artifacts.
- `UNVERIFIED` Light cross-links in sibling docs are in scope; Plan Survey is not redesigned.

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- (none)

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- (none — Round 1/2 MAJORs revised into design/plan)

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist or the plan-level
Reviewer pass, if it reached the plan at all rather than being split or rewritten.

- `UNVERIFIED` Full agentic quality of Explore (map usefulness on a real repo) is **manual** after implement — `npm test` proves wiring + skill text presence, not conversational quality. Accept residual risk or run a one-shot manual smoke after rebuild.

## Resolution
- Naming, order, chat-only, full-skill: resolved by user answers at intake.
- Manual smoke residual: carried to approval gate; human may waive or require a smoke after install.
