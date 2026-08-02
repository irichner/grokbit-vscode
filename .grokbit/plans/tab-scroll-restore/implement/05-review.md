# Scope audit log — tab-scroll-restore

Append-only, one section per task.

## T1 — Host scroll memory + scrollState handler
Reviewed: working tree (commit deferred per project convention)

- `IN_SCOPE` `src/session.ts` — scrollStickToBottom / scrollTop fields
- `IN_SCOPE` `src/session-scroll.ts` — pure reset/apply/pick/envelope
- `IN_SCOPE` `src/sidebar.ts` — WebviewMsg scrollState, startSession reset, onMessage handler
- `IN_SCOPE` `test/session-scroll.test.ts` — verify suite

Clean. Every hunk is `IN_SCOPE`.

## Outcome — T1
Rounds used: 1 of 2
Unresolved at cap: none

## T2 — Pure clamp + restore decision helper
Reviewed: working tree

- `IN_SCOPE` `media/webview-helpers.js` — clampScrollTop + export
- `IN_SCOPE` `test/webview-helpers.test.ts` — clamp + shouldStickToBottom reuse

Clean.

## Outcome — T2
Rounds used: 1 of 2
Unresolved at cap: none

## T3 — Webview panelReplaying + report/flush scrollState
Reviewed: working tree

- `IN_SCOPE` `media/chat.js` — panelReplaying, begin/end, suppress force/scroll, visibility flush
- `IN_SCOPE` `test/tab-scroll-restore.dom.test.ts`

Clean. Note: T4 host wire already present in same sidebar session (depends T1+T3) — audited under T4.

## Outcome — T3
Rounds used: 1 of 2
Unresolved at cap: none

## T4 — Wire begin/end around host replayInto
Reviewed: working tree

- `IN_SCOPE` `src/sidebar.ts` replayInto begin/try/finally/end
- `IN_SCOPE` `src/session-scroll.ts` buildPanelReplayEnvelope
- `IN_SCOPE` `test/panel-replay-scroll.test.ts`

Clean. Router signature unchanged.

## Outcome — T4
Rounds used: 1 of 2
Unresolved at cap: none

## T5 — Full suite
No product code beyond prior tasks. Verify = full `npm test` → **1408 passed**.

### Incidental (D1)
- `INCIDENTAL` `test/question-card.dom.test.ts`, `test/plan-history-restore.dom.test.ts` — filter ambient `scrollState` from exact `posted` equality (forceScroll now reports host memory)

## Outcome — T5
Rounds used: 1 of 2
Unresolved at cap: none
