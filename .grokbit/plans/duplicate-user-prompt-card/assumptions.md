# Assumptions — Remove duplicate user prompt card

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` “Remove the second one” means remove the **redundant** surface on the **active** turn so prompt text appears once. The surviving surface for an active turn is the full sticky user prompt (not a header-only strip), matching the prior turn-container design diagram.
- `UNVERIFIED` For an **expanded prior** turn, a compact header (accordion control) above the full prompt body is acceptable even if summary text echoes the prompt — the user’s reported bug is the active-send double card.
- `UNVERIFIED` Completed active turn (answer landed, user has not sent again) still counts as “active” for layout until the next send — same as current `state.activeTurnEl` / `.turn.active` behavior.

## From grounding (Loop 2)

- (none — entities resolved)

## From adversarial review (Loop 3)

- (none outstanding)

## From verifiability (Loop 4)

- (none)

## Resolution

- Active-vs-expanded scope: encoded in narrowed DC1 and design Option A.
- Visibility assertion: required in `plan.md` T1 verify (not left optional).
- Human may overrule: if they want expanded prior turns to also hide the header summary, that is a small follow-up CSS/JS change (not in this plan’s tasks).
