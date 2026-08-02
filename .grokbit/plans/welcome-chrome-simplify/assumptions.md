# Assumptions — Simplify session-tab welcome chrome

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` "On the tabs" means **session editor tabs** (welcome canvas), not the activity-bar launcher.
- `UNVERIFIED` Elements **below** Session Setup / Grokbit Actions (onboarding mount, About byline) stay.
- `UNVERIFIED` Removing `#welcome-version` entirely is acceptable (About + onboarding card headings cover status).
- `UNVERIFIED` Prefer REPLACE of `welcomeGuide` and dead CSS/JS over leaving orphan UI code.

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- none

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- none (Round 1 MAJORs resolved: `startingPhase` is version-only and removed with the line; full status-line removal intentional)

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist or the plan-level
Reviewer pass.

- none expected after plan-level pass

## Resolution
Human may overrule at the gate: e.g. keep About-only status during onboarding via a single muted line, or also remove the About byline (would expand scope).
