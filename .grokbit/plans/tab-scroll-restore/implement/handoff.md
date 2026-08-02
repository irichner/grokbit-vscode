# Implement handoff — tab-scroll-restore

Input contract for `grokbit-test` verify mode.

## Completed
- T1 — Host scroll memory + scrollState + startSession reset (commit deferred)
- T2 — clampScrollTop pure helper
- T3 — panelReplaying begin/end + suppress force/scrollState + visibility flush
- T4 — GrokSidebar.replayInto begin/try/finally/end wire
- T5 — full suite 1408 green

## Blocked
- none

## Surface changed
Files:
- `src/session.ts` — scroll fields
- `src/session-scroll.ts` — new pure helpers
- `src/sidebar.ts` — scrollState handler, startSession reset, replayInto bookends
- `media/webview-helpers.js` — clampScrollTop
- `media/chat.js` — panel replay restore pipeline
- `test/session-scroll.test.ts`, `test/panel-replay-scroll.test.ts`, `test/tab-scroll-restore.dom.test.ts` — new
- `test/webview-helpers.test.ts` — clamp cases
- `test/question-card.dom.test.ts`, `test/plan-history-restore.dom.test.ts` — ignore ambient scrollState

Endpoints added/changed: none  
Schema changes: none  
UI views affected: session chat tab scroll on reveal  
Dependencies added: none

## Look here hard
- Real VS Code multi-tab hide/reveal (done-criteria 1–4) — not automated in suite
- Permission/question force-scroll still works when tab is visible (gated only during panelReplaying)
- startSession must keep resetting scroll memory (source-text test locks this)
- Async media reflow after end may slightly drift scrollTop (accepted)

## Deviations
See `deviations.md` — 1 recorded (test assertion filter for ambient scrollState).

## Baseline reference
Preflight suite 1389 green; post-change 1408 green. Prior always-pin-on-reveal behavior replaced for mid-scroll restore.
