# Release readiness — duplicate-user-prompt-card

## Deployment target
Detected: **NONE DETECTED** as a web app host — this is a **VS Code extension** (Marketplace / local `.vsix` via `npm run package` / `npm run rebuild`).

SHIP here means the extension unit suite and done-criteria for this change are sound enough to package/reinstall; it is not a claim about a live web deployment.

## Verdict
**SHIP WITH CAVEATS**

The duplicate active-turn prompt header is fixed in CSS and guarded by automated tests. Full suite is green (1392). No security findings. Manual UI confirmation in a live session tab after local rebuild is still recommended because happy-dom cannot paint sticky/layout or prove the header is invisible to the eye.

## Evidence
- Done-criteria proven: 6 of 6 (sticky proven as CSS/class contract)
- Regressions: 0 unexpected (`REGRESSION`); dual-prompt change is `INTENDED`
- Security: 0 critical / 0 high / 0 medium
- Build: unit suite pass · Visual: UNVERIFIED (no headless webview)

## Build
| Check | Result |
|---|---|
| Unit / DOM suite (`npm test`) | PASS — 1392 tests |
| Turn-container targeted suite | PASS — 10 tests |
| Production vsix package | NOT RUN this session (not required for this CSS fix; user may `/rebuild`) |
| Production start + health check | N/A (extension host) |
| Bundle size delta | trivial CSS + test only |

## Environment parity
No new env vars. Extension settings unchanged.

| Var | Code requires | Target defines |
|---|---|---|
| (none new) | — | — |

## Migrations
None.

## Caveats
- **Manual UI check:** open a Grokbit session tab, send a prompt, confirm only one prompt card (no chevron header above the bubble); send a second prompt and confirm the first collapses to a one-line header.
- **No auto-commit:** changes are in the working tree only; rebuild/install when ready.
- Visual/sticky pixel layout not verified headless.

## Blockers
- none
