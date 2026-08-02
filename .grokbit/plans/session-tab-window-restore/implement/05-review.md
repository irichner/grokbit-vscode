# Scope audit — session-tab-window-restore

## T1 — Pure decidePanelRestore
- Files touched: `src/panel-restore.ts`, `test/panel-restore.test.ts` — **IN_SCOPE**
- No OUT_OF_SCOPE hunks

## T2 — Keep activeSessionId on resume
- Files: `src/sidebar.ts` (startSession assign), `src/panel-restore.ts` (`activeSessionIdForStart`), tests — **IN_SCOPE**
- No undeclared deletions

## T3 — Wire restorePanel
- Files: `src/sidebar.ts` restorePanel rewrite — **IN_SCOPE**
- removes: silent new-session for empty id — **declared**
- No await of startSession — **correct**

## T4 — sessionIdentity re-stash
- Files: `src/sidebar.ts` postSessionIdentity + ready, `media/chat.js` case, `test/backend-chip.dom.test.ts` — **IN_SCOPE**
- Note: plan listed optional `test/panel-restore.dom.test.ts`; used existing backend-chip file instead — **INCIDENTAL** choice of test location, same verify intent

## T5 — Full suite
- No code; suite green

## Outcome
All tasks IN_SCOPE or declared. No promoted tasks.
