# Scope audit — welcome-chrome-simplify

## T1 — Strip welcome markup
Diff vs declared files: `src/sidebar.ts`, `test/webview-harness.ts`

| Hunk | Class | Notes |
|---|---|---|
| Delete welcome-mark/tagline/version/guide from getHtml | IN_SCOPE | matches removes: |
| Keep h2, grid, onboarding, about | IN_SCOPE | intent |
| Harness BODY mirror | IN_SCOPE | plan files |

OUT_OF_SCOPE: none.  
removes: fulfilled.

## T2 — JS lifecycle + helper
Diff vs declared files: `media/chat.js`, `media/webview-helpers.js`

| Hunk | Class | Notes |
|---|---|---|
| Delete hide/renderWelcomeGuide + call sites | IN_SCOPE | |
| Delete version writers + startingPhase | IN_SCOPE | |
| Keep flushVoiceQueue, cliVersion | IN_SCOPE | design constraint |
| Empty cliUpdating case (no-op break) | IN_SCOPE / INCIDENTAL | host may still post; no status UI |
| Delete welcomeGuide + export | IN_SCOPE | |

OUT_OF_SCOPE: none.

## T3 — CSS + tests
Diff vs declared files: `media/chat.css`, `test/welcome-canvas.dom.test.ts`, `test/webview-ui.dom.test.ts`, `test/webview-helpers.test.ts`, `test/chat-layout.dom.test.ts`

| Hunk | Class | Notes |
|---|---|---|
| Delete mark/tagline/guide CSS; slight welcome padding | IN_SCOPE | padding optional in plan notes |
| Rewrite welcome-canvas to absence suite | IN_SCOPE | |
| Replace version-line describe | IN_SCOPE | |
| Delete welcomeGuide unit tests | IN_SCOPE | |
| Retarget tagline layout [R] | IN_SCOPE | |

OUT_OF_SCOPE: none.

## Outcome
All tasks IN_SCOPE. No promotions. Commits deferred (project policy).
