# Implement handoff — welcome-chrome-simplify

Input contract for `grokbit-test` verify mode.

## Completed
- T1 deferred — strip welcome markup above cards (logo, tagline, version, guide); keep Grokbit h2 + grid + onboarding + About
- T2 deferred — remove guide/version JS lifecycle, `startingPhase`, `welcomeGuide` helper; keep `flushVoiceQueue` + `cliVersion`
- T3 deferred — CSS cleanup + rewrite tests; `npm test` 1377 green

## Blocked
- none

## Surface changed
Files:
- `src/sidebar.ts` (getHtml welcome tree)
- `test/webview-harness.ts` (BODY mirror)
- `media/chat.js`
- `media/webview-helpers.js`
- `media/chat.css`
- `test/welcome-canvas.dom.test.ts`
- `test/webview-ui.dom.test.ts`
- `test/webview-helpers.test.ts`
- `test/chat-layout.dom.test.ts`

Endpoints: none  
Schema: none  
UI views: session-tab welcome canvas only  
Dependencies added: none

## Look here hard
- Empty-session first paint: only "Grokbit" above Session Setup / Grokbit Actions
- Onboarding cards still replace setup/actions (no version line status)
- Gear → About still has CLI version (`cliVersion`)
- Launcher New-session logo untouched
- Suite count dropped 1392 → 1377 (removed guide/version characterization tests by design)

## Deviations
See `deviations.md` — 0 counted (waivers only: deferred commits, dirty tree, baseline reuse).

## Baseline reference
Captured: `test/baseline.md` (other plan's capture exists) | welcome chrome pre-change: suite green + plan task baselines; INTENDED removals in `03-design.md` Option A
