# Scope audit — create-workflow-screen-ux

## T1

- Files: plan dir notes + informed Path B in T3/host
- Hunks: IN_SCOPE discovery only

## T2

- `media/chat.js`, `media/chat.css`, `media/webview-helpers.js`, tests — IN_SCOPE layout/validate
- INCIDENTAL: field helper uses span label wrapper for name row

## T3

- Craft session + `workflowDetailToBuilderDraft` + host `postWorkflowCraftResult` — IN_SCOPE (Path B allowed after T1)
- `src/sidebar.ts` not listed on T2; listed on T3 as “host only if Path B” — IN_SCOPE

## T4

- README + CLAUDE copy — IN_SCOPE

## Outcome

No OUT_OF_SCOPE hunks retained. No undeclared removals beyond plan (Constraints, seed-only close).
