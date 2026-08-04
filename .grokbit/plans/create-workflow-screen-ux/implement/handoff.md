# Handoff — create-workflow-screen-ux → grokbit-test

| Field | Value |
|---|---|
| Slug | `create-workflow-screen-ux` |
| Phase | implement complete |
| Date | 2026-08-03 |
| hand_back_cycle | 0 |
| snapshot | none (dirty tree left in place; no stash) |

## Completed tasks

- T1 Path B host message for craft apply
- T2 Layout + name required + scope toggle + drop Constraints + canvas under Goal
- T3 In-place Craft auto-send + compact status + apply proposal
- T4 Docs + full suite green

## Blocked

none

## Files touched

- `media/chat.js`
- `media/chat.css`
- `media/webview-helpers.js`
- `src/sidebar.ts`
- `test/webview-helpers.test.ts`
- `test/capabilities.dom.test.ts`
- `README.md`
- `CLAUDE.md`
- `.grokbit/plans/create-workflow-screen-ux/**`

## Dependencies added

none

## Deviations

See `deviations.md` — counting total 0 (policy notes only).

## Test should look hard at

- Craft auto-send posts `{ type: "send" }` and leaves builder visible with working banner
- `workflowCraftResult` repopulates phases/agents
- Name required validation
- Compact `.wf-crafting` does not full-screen cover chat
- Host kebab-name guard on craft result lookup
- No Constraints in brief or UI

## Suite at handoff

`npm test`: 1705 passed, 80 files
