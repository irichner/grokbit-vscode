# Handoff — session-tab-window-restore → grokbit-test

## Completed
| Task | Notes |
|---|---|
| T1 | `decidePanelRestore` / `activeSessionIdForStart` pure module + tests |
| T2 | Resume keeps `activeSessionId` for whole startSession window |
| T3 | restorePanel policy: resume / reveal-existing / dispose-orphan |
| T4 | `{type:"sessionIdentity"}` on ready → webview setState |
| T5 | `npm test` — 1439 passed |

## Blocked
- none

## Files touched
- `src/panel-restore.ts` (new)
- `src/sidebar.ts`
- `media/chat.js`
- `test/panel-restore.test.ts` (new)
- `test/backend-chip.dom.test.ts`
- plan/implement docs under `.grokbit/plans/session-tab-window-restore/`

## Dependencies added
- none

## Deviations
- 0 counting
- Commits deferred (project policy)
- Test file for T4: backend-chip.dom.test.ts instead of new panel-restore.dom.test.ts

## Dirty-tree snapshot
- snapshot: none (proceeded dirty; unrelated WIP left alone)

## hand_back_cycle
- 0

## What verify should look at hard
1. restorePanel never starts a new session without an id (dispose-orphan).
2. startSession resume keeps activeSessionId (source + pure helper).
3. sessionIdentity setState path.
4. Full suite still green.
5. Manual: Developer: Reload Window with two history tabs (cannot automate here).

## Manual checklist (for human / release)
- [ ] Two tabs with history → Reload Window → both show prior conversation
- [ ] Claude tab stays Claude after reload
- [ ] While connecting, open same session from launcher → no duplicate tab
- [ ] Background tab resumes on first focus
- [ ] Optional: full quit/reopen same workspace
