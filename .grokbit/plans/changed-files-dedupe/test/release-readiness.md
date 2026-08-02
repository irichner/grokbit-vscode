# Release readiness — changed-files-dedupe

## Deployment target
Detected: NONE DETECTED (VS Code extension; Marketplace via `npm run rebuild` / vsce — not a web PaaS).

No web deployment target exists for this change. Build checks below are local extension compile + unit suite. SHIP means the change is sound to include in the next extension rebuild/publish, not that a site is live.

## Verdict
**SHIP**

The changed-files strip now lists each path once with summed line metrics when a file is re-edited in the same turn. All done-criteria are proven by the DOM suite; full project suite is green (1410); typecheck clean; no security findings; intentional behavior change only for same-path multi-edit.

## Evidence
- Done-criteria proven: 6 of 6 (unverified: none)
- Regressions: 0 (1 INTENDED same-path display change)
- Security: 0 critical / 0 high / 0 medium
- Build: pass (`tsc -p . --noEmit`) · Suite: 1410 pass · Visual: DOM-proven

## Build
| Check | Result |
|---|---|
| Production typecheck (`npx tsc -p . --noEmit`) | PASS |
| Unit suite (`npm test`) | PASS — 1410 |
| Production start + health check | n/a — VS Code extension webview |
| Bundle size delta | not measured (webview JS only; no package this session) |

## Environment parity
| Var | Code requires | Target defines |
|---|---|---|
| (none for this change) | — | — |

## Migrations
None.

## Caveats
- Not yet packaged into a Marketplace vsix in this session — include in next `/rebuild` when you want it installed.
- Metrics for multi-edit are **summed per-edit** line counts (not true first→last net); matches approved plan assumptions.

## Blockers
None.
