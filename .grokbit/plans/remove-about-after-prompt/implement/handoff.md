# Implement handoff — remove-about-after-prompt

Input contract for `grokbit-test` verify mode.

## Completed
- T1 (uncommitted — project forbids auto-commit) — Honor `[hidden]` on welcome so About Grokbit + title stop painting after first send
- T2 skipped — empty-canvas About removal not requested

## Blocked
- none

## Surface changed
Files: `media/chat.css`, `test/welcome-canvas.dom.test.ts`
Endpoints added/changed: none
Schema changes: none
UI views affected: session-tab welcome canvas after first send (About link + Grokbit heading hide with whole `#welcome`)
Dependencies added: none

## Look here hard
- In a real VS Code webview (Chromium), confirm after Send that **About Grokbit** and the **Grokbit** title are gone — automated suite cannot load `chat.css` into happy-dom, so paint is proven by CSS source rule + `hidden` attribute wiring only.
- Primer-only restore still keeps welcome (`test/primer-only-restore.dom.test.ts` green).
- Empty-canvas About byline intentionally still present (LEAVE / T2 not taken).

## Deviations
See `deviations.md` — 0 plan contradictions; 3 waivers (dirty tree, no auto-commit, baseline file from other slug).

## Baseline reference
Captured: `test/baseline.md` (chat-turn-containers; includes primer-only welcome must-not-regress). No dedicated pre-change screenshot for this slug — reduced regression claims for pure visibility paint in browser.
