# Scope audit log — raise-plan-implement-accuracy

Append-only, one section per task. Never overwrite a previous task's entry.

## T1 — Add vitest coverage tooling (no fail_under)
Reviewed: working tree before commit

- `IN_SCOPE` `package.json` — `test:coverage` script + `@vitest/coverage-v8` devDependency
- `IN_SCOPE` `package-lock.json` — lockfile for the new dep
- `IN_SCOPE` `vitest.config.ts` — `coverage.provider: v8`, include `src/**`, exclude `test/**`/`out/**`, no thresholds

### Outcome — T1
Rounds used: 1 of 2
Unresolved at cap: none
Clean. Every hunk is `IN_SCOPE`.

## T2 — Record coverage baseline (measurement only)
Reviewed: working tree before commit

- `IN_SCOPE` `.grokbit/plans/raise-plan-implement-accuracy/implement/coverage-baseline.md` — measured whole-package % from `npm run test:coverage`

### Outcome — T2
Rounds used: 1 of 2
Unresolved at cap: none
Clean.

## T3 — Wire real Lint + Coverage in AGENTS.md Project Test Commands
Reviewed: working tree before commit

- `IN_SCOPE` `AGENTS.md` — Coverage → `npm run test:coverage`; Lint → `npx tsc -p . --noEmit`; Build left TODO

### Outcome — T3
Rounds used: 1 of 2
Unresolved at cap: none
Clean.

## T4 — Retire coverage-no-tool waiver
Reviewed: working tree before commit

- `IN_SCOPE` `docs/waivers/coverage-no-tool.md` — rewritten Superseded/Expired with pointer to tooling + AGENTS Coverage row + baseline residual risk

### Outcome — T4
Rounds used: 1 of 2
Unresolved at cap: none
Clean.

## T5 — Dual-pipeline when-to-use documentation
Reviewed: working tree before commit

- `IN_SCOPE` `docs/grokbit-workflows.md` — when-to-use matrix + chat-only ban
- `IN_SCOPE` `docs/WORKFLOW.md` — strengthened pointer to suite doc and dual-pipeline choice

### Outcome — T5
Rounds used: 1 of 2
Unresolved at cap: none
Clean.

## T6 — Regression: unit suite + typecheck
Reviewed: verify-only (no source files required)

- `IN_SCOPE` no product hunks — `npm test`, `npx tsc -p . --noEmit`, `npm run test:coverage` all exit 0

### Outcome — T6
Rounds used: 1 of 2
Unresolved at cap: none
Clean (no commit).
