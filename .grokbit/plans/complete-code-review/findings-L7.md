# L7 Peripheral + test floor

## Reviewed

- `src/prompt-builder.ts` envelope design
- `src/token-metrics.ts` — data-only exports (no imports/logic)
- `src/chips.ts`, file-ref, pending-images — via tests presence
- `src/telemetry.ts` (also L1)
- CI `.github/workflows/ci.yml`
- Suite run evidence (this session)

## Findings

### [Minor] No coverage tooling / no lint in CI

- **Where:** project test commands; `ci.yml` only compile+test+package.
- **Why:** Known absence; accuracy gates cannot measure % coverage.
- **Fix:** Optional later; not a ship blocker for current architecture.

### [Nit] `$null` path in dirty `git status`

- Noise file; not product. Delete when cleaning tree.

### [Nit] What’s next still lists E6 React Flow as ADR-required stretch

- **Where:** `Claude.md:240` vs accepted `docs/adr/0004-workflow-builder-canvas.md` vanilla for Workflow Builder.
- **Why:** Partial docs drift (Business Studio E6 vs Create Workflow path).
- **Fix:** Clarify E6 vs ADR 0004 scope in What’s next / Known limits.

## Suite + compile evidence

| Command | Result | When |
|---|---|---|
| `npm run compile` | exit 0 | 2026-08-02 review session |
| `npm test` | **74 files, 1529 tests passed**, ~3.9s | 2026-08-02 review session |

## Module→test map (presence, not %)

| Area | Representative tests |
|---|---|
| plan-gate | `test/plan-gate.test.ts` (38) |
| permission-bind | `test/permission-bind.test.ts` (26) |
| capabilities | `test/capabilities.test.ts` (73) + DOM |
| acp | `test/acp.test.ts`, `acp-integration` (18) |
| sessions/store | `sessions.test.ts`, `session-store.test.ts` |
| webview | many `*.dom.test.ts` |
| token-metrics | `token-metrics.test.ts` (5) — data module guard |
| env-filter | `env-filter.test.ts` (10) |
| terminal | `terminal-manager.test.ts` (16) |
