# Assumptions — workflow-tile-agents-and-reviews

Marker vocabulary: `UNVERIFIED` = a fact assumed rather than read from disk. `UNRESOLVED — <loop>` = a loop reached its cap without settling the question.

## UNVERIFIED

- **Scope is the six bundled suite tiles.** "The grokbit workflow tiles displayed on the new tab" is read as the `grokbit` group on the welcome canvas (`#capabilities-panel`). The Actions popover renders from the same builder and therefore inherits the change; treated as desirable, not scope creep.
- **User Workflows are out of scope.** `kind: "workflow"` tiles get their agents from parsing the user's own script, already surfaced in the workflow Details view. Giving them a static manifest would be meaningless.
- **Role names in full, not a count.** "Describe the agents involved" is read as naming them.
- **`reviews` is a phrase, not an integer.** Justified in 03-design.md Decision 2; the caps differ in kind and a single number would be an invented comparison.
- **Exact copy is provisional.** The strings in the Decision 2 table are proposals. They are the most likely thing to change at the gate and none of the implementation depends on their wording — only on their numerals appearing in the guides.

## Verified during survey (recorded so the Reviewer need not re-check)

- `grokbit-ship` genuinely has no roster of its own — `resources/skills/grokbit-ship/references/how-it-works.md` § Roles states it verbatim.
- `capabilityGroupsView` is an explicit field whitelist, so a new host field must be added there or it never reaches the renderer (`media/webview-helpers.js:1241-1259`).
- `chat.css` contains no `@media` queries and must not gain one (`body` carries `zoom`).
- The parity-test idiom already exists (`test/hook-parity.test.ts`).

## UNRESOLVED

None. No loop hit its cap.

## Open question for the gate

The `reviews` wording for **implement** (`2 scope-audit rounds; 3 attempts per task`) mixes a review count with a retry count. It is the most accurate short phrase available, but if the tile should state *only* review activity, it becomes `2 scope-audit rounds` and the retry cap stays in Details. Flagged rather than silently decided.
