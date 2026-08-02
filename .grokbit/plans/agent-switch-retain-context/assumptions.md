# Assumptions — Switch Agents on any tab and retain context

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` “Full context” means **(1) keep the visible transcript in the tab** and **(2) seed the new agent with as much prior user/assistant text as fits a safe budget**, not a true shared session id across CLIs.
- `UNVERIFIED` Default plan is **carry context without a lose-history modal** (still block while priming / mid-turn).
- `UNVERIFIED` Prefer **deterministic transcript extract from the host buffer**; summarize only if extract is empty/unusable.
- `UNVERIFIED` After switch, the tab’s live `activeSessionId` becomes a **new** session on the target backend; the prior id stays on the source backend’s disk.

## From grounding (Loop 2)
None — entities resolved with citations in `02-survey.md`.

## From adversarial review (Loop 3)
None outstanding — Round 1–2 BLOCKER/MAJOR findings folded into `03-design.md` Restore algorithm.

## From verifiability (Loop 4)
- `UNVERIFIED` Host `switchBackend` orchestration will remain largely outside happy-dom unit tests (consistent with existing sidebar patterns); pure handoff + message contracts + manual smoke close the gap. If implement finds a clean extract of “shouldDiscardOnBackendFlip / buildHandoffEnvelope” pure, prefer that for verify strength.

## Resolution
Gate items for human:

1. Confirm “full context” interpretation (transcript UI + bounded seed) is enough vs. demanding bit-perfect tool state (non-goal).
2. Confirm no modal on history flip is OK.
3. Confirm leaving the old history row on disk (new row after flip) is the desired identity model.
