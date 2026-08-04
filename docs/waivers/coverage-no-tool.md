# Waiver: coverage gate — no coverage tool

- **Status:** **Superseded / Expired** (2026-08-03)
- **Date (original):** 2026-07-16
- **Author:** install-agentic-team (Lead Engineer session); superseded by plan `raise-plan-implement-accuracy`
- **Scope:** Whole Grokbit repo (VS Code extension; vitest unit suite)
- **Gate waived (historical):** coverage when no tool existed
- **Reason (historical):** Project had no coverage tooling; AGENTS.md listed Coverage as NONE.
- **Superseded by:**
  - Tooling: `@vitest/coverage-v8` + `npm run test:coverage` (`package.json` / `vitest.config.ts`)
  - AGENTS.md Project Test Commands **Coverage** row: `` `npm run test:coverage` ``
  - Baseline measurement: `.grokbit/plans/raise-plan-implement-accuracy/implement/coverage-baseline.md` (whole-package lines **32.29%** on 2026-08-03)
- **Must not claim as current truth:** “no coverage tooling” — tooling **exists**.
- **Residual risk (still real):** Whole-package line coverage is **below 80%**; **changed-line** coverage remains **UNMEASURED / no tool** (no diff-cover). Do **not** enable vitest `thresholds`/`fail_under` until a deliberate raise-coverage effort. Accuracy still relies on green unit/regression tests + review for changed lines.
- **Follow-up:** Optional changed-line tooling + raise whole-package %; only then consider fail_under.
- **Expiry condition (met):** REAL Coverage command in `AGENTS.md` + tooling in `package.json` devDependencies.
