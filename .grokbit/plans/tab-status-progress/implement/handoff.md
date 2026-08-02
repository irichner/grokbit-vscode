# Implement handoff — tab-status-progress

Input contract for `grokbit-test` verify mode.

## Completed
- T1 deferred-commit — pure tab title status + progress formatting (`composeTabTitle`, `tabTitleStatusFrom`, `tabStatusHead`)
- T2 deferred-commit — host wires status/progress into panel titles via `setStatus`, `toolCall`, `markRead`

## Blocked
- none

## Skipped
- T3 optional status icons — not needed for done-criteria

## Surface changed
Files: `src/sessions.ts`, `test/sessions.test.ts`, `src/session.ts`, `src/sidebar.ts`
Endpoints added/changed: none
Schema changes: none
UI views affected: VS Code editor tab titles for session panels (not webview DOM)
Dependencies added: none

## Look here hard
- Background tab title updates depend on `setStatus` + `panel` still existing (true for open tabs).
- `markRead` must clear `*` / `!` when focusing a finished-away tab — host-only path.
- Progress only increments on distinct `toolCallId` while `status === "working"` — narration-only turns show bare `…`.
- Dirty tree already had unrelated edits in `session.ts` / `sidebar.ts`; this work is layered on that WIP — test isolation is pure modules only.

## Deviations
See `deviations.md` — 0 counted; commits deferred per project policy.

## Baseline reference
Captured: `test/baseline.md` (pre-existing; not re-authored this session)

## Manual smoke (required for host chrome)
1. Open two session tabs.
2. Send a multi-tool prompt on tab A while focused on B → A title shows `…` then `…N`.
3. Trigger permission/question on A → title `?`.
4. Let A finish in background → title `*`; focus A → marker clears.
