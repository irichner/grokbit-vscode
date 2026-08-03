# L3 Session / host lifecycle

## Reviewed (force-checklist)

| Flow | Evidence |
|---|---|
| startSession backend branch | `sidebar.ts` + `backends` quirks usage (module map / grep `session.backend`) |
| ready / replay | `panel-router.ts` pure core; `retainContextWhenHidden:false` documented |
| logout per-backend | `sidebar.ts:1808+` `logout` → `logoutGrok`/`logoutClaude` + `disposePool(backend)` |
| permission path | `sidebar.ts:2594+` plan reject + `autoApprove` (`:2609`) |
| plan approve/reject | primer contract + plan-restore; exit handlers in sidebar |
| resume + backend | WP5 openTabForId/restorePanel carry backend (docs + session-store merge) |

## Sampling (DC9)

- **sidebar.ts** ~5442 lines: deep-dived logout, permission auto-approve, openFile, filterDotEnv call site (~5289), media roots; did **not** line-audit every message case.
- Pure: `panel-router`, `session-pool`, `status-bar`, `session-store` covered by dedicated unit tests (green).

## Findings

### [Minor] `openFile` accepts absolute paths outside workspace

- **Where:** `sidebar.ts:2976-3009` — `isUsableFilePath` then `vscode.Uri.file(p)` with no workspace containment.
- **Why:** Webview is extension-owned; still a larger blast radius if XSS/`postMessage` spoofing ever lands. Defense-in-depth would restrict to workspace + grok-home media roots unless user confirmed.
- **Fix:** Optional: reject absolute paths outside workspace/homedir allowlist for capability-driven opens.

### [Minor] Soft live-session bound only

- **Where:** Known limit + session pool policy (no hard kill).
- **Why:** Resource exhaustion with many tabs is accepted product risk.
- **Fix:** None (documented).

## Clean / solid

- Per-backend logout fixed (historical bug of Claude tab logging out grok).
- PanelRouter ready/buffer design is testable and intentional.
- History pagination merge + diskCount cursor (session-store) is carefully specified and tested.
