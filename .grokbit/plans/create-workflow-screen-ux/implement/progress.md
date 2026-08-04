# Progress — create-workflow-screen-ux

| Task | Status | Notes |
|---|---|---|
| T1 | done | Path B: `getWorkflowCraftResult` / `workflowCraftResult` — detail requires path |
| T2 | done | Name first required + large, scope toggle, no Constraints, canvas column |
| T3 | done | Stay open, auto-send, compact craft chrome, apply via craft result |
| T4 | done | README + CLAUDE updated; `npm test` 1705 passed |

## Commits

Skipped per CLAUDE.md (no commit outside rebuild/release). Tree left dirty for user.

## Verifies run

- T1: Select-String / source read → Path B
- T2/T3: `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts` — 274 passed
- T4: `npm test` — 1705 passed; `npx tsc -p . --noEmit` clean
