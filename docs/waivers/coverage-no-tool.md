# Waiver: coverage gate — no coverage tool

- **Date:** 2026-07-16
- **Author:** install-agentic-team (Lead Engineer session)
- **Scope:** Whole Grokbit repo (VS Code extension; vitest unit suite)
- **Gate waived:** coverage
- **Reason:** Project has no coverage tooling (`pytest-cov` / `vitest --coverage` / diff-cover not configured). AGENTS.md Project Test Commands correctly list Coverage as NONE. Accuracy gates still require green unit/regression tests and review; coverage % is not enforceable until tooling is added.
- **Residual risk:** Changed-line coverage is not measured; regressions may land without coverage signal.
- **Follow-up:** Optionally add vitest coverage (`@vitest/coverage-v8` or equivalent) + document a changed-line gate; then remove this waiver and set a REAL Coverage command in `AGENTS.md`.
- **Expiry:** When a REAL Coverage command is added to `AGENTS.md` and tooling is in `package.json` devDependencies.
