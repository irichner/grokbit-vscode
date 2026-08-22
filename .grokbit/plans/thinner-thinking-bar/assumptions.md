# Assumptions — Thinner thinking bar

The one rolled-up ledger of every open item from this plan.

## From intake

Copied from `01-intent.md`'s `## Assumptions`.

- `UNVERIFIED` The requested surface is `#thinking-bar` (0.6s cycling neon strip under the top bar), not `.activity-strip` and not `.mic-waves`.
- `UNVERIFIED` Target height is **2px**. User may override to 1px or 3px at the approval gate (same Option A, different literal + test pin).
- `UNVERIFIED` happy-dom cannot assert computed px; CSS source-text (`height: 2px` on `.thinking-bar {`) is the machine check. Lead UI verify names **2px** at 100% zoom and visibility at 60% zoom (`NO UI TOOLING`) — not a metaphor.

## From grounding (Loop 2)

None. All intent-implied entities resolved (markup, CSS rule, keyframes, reduced-motion, JS visibility, tests, unrelated 4px mic bars, missing height token, missing Playwright).

## From adversarial review (Loop 3)

*(filled after Reviewer pass)*

## From verifiability (Loop 4)

*(filled after plan-level Reviewer pass)*

## Resolution

Intake assumptions are carried to the human gate. They do not block design: a gate override of 1px/3px is still Option A.
