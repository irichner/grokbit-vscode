# Test results — welcome-chrome-simplify (verify)

## Reduced baseline note
`test/baseline.md` exists for chat-turn-containers, not a full welcome-chrome characterization suite. Regression claims for chrome use plan `03-design.md` Option A + preflight green suite (1392) vs post-change (1377).

## Regression

| Change | Class | Citation |
|---|---|---|
| Logo / tagline / version / guide removed from welcome | INTENDED | `03-design.md` Option A, disposition REPLACE |
| `welcomeGuide` deleted; unit tests removed | INTENDED | same |
| Version-line lifecycle tests rewritten to absence | INTENDED | same |
| Suite 1392 → 1377 | INTENDED | removed guide/version tests |
| Session Setup / Actions / onboarding / About | unchanged path | suite green |

REGRESSION: none  
UNKNOWN: none

## Done-criteria coverage (`01-intent.md`)

| Criterion | Result | Evidence |
|---|---|---|
| Only Grokbit above cards | PASS | `test/welcome-canvas.dom.test.ts` order + absence |
| No logo | PASS | same |
| No tagline | PASS | same + chat-layout |
| No guide | PASS | same; no welcomeGuide export |
| No Starting status line | PASS | webview-ui absence tests |
| Setup + Actions work | PASS | session-setup + capabilities DOM suites (full npm test) |
| Onboarding usable | PASS | welcome-canvas + webview-ui onboarding tests |
| npm test green | PASS | 1377 / 64 files |

## Visual
UNVERIFIED — no headless VS Code webview capture in this environment. Human should open a new session tab and confirm title-only chrome.

## Maintenance
- removes: all REPLACE items absent from markup/JS/CSS (verified by greps + suite)
- leftover comment strings "startingPhase" in unrelated DOM test *names* only — not runtime debris
- No orphan files created

## Baseline retirement
N/A for separate baseline characterization files of this slug. Welcome-guide unit describe deleted as part of T3 INTENDED removal (already reflected in tree).
