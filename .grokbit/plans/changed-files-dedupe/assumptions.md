# Assumptions — Changed-files strip: one chip per file

## From intake
Copied from `01-intent.md`.

- `UNVERIFIED` The repeated names are primarily **same path** re-edited in one turn (Map keyed by toolCallId), not only two directories sharing a basename. Basename collisions remain a pre-existing LEAVE unless product later asks for disambiguation.
- `UNVERIFIED` Desired metrics for multi-edit of one path are **summed** per-edit add/del line counts (turn churn), not latest-edit-only and not true first-old→last-new net.

## From grounding (Loop 2)
None — all entities resolved with citations.

## From adversarial review (Loop 3)
None outstanding (Round 2 clean).

## From verifiability (Loop 4)
None.

## Operational notes (not blockers)
- If the agent emits the same file under two different path spellings (`src/a.ts` vs `src\a.ts`), chips will not merge — no normalization in this plan.
- True net-diff aggregation is an explicit non-goal; can be a follow-up if summed churn misleads users.

## Resolution
Human may overrule sum vs latest-only at the approval gate; if latest-only is preferred, T1 aggregation changes from sum to replace-on-path while **still** needing per-toolCallId storage for partial forget (closer to Option B). Default remains sum per design.
