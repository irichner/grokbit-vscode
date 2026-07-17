# Agentic team install handoff

- **Date:** 2026-07-16
- **Template version:** 1.7
- **git_mode:** full
- **Companion rules (unchanged):** CLAUDE.md

## Project Test Commands status

- **Build:** TODO — TODO — user must fill
- **Unit tests:** REAL — `npm test` (evidence: manifest/CI scan)
- **Coverage:** NONE — NONE — no tool in repo (evidence: no pytest-cov / --cov in scan)
- **Regression / full suite:** REAL — `npm test` (evidence: manifest/CI scan)
- **Lint:** NONE — NONE — no tool in repo

## Actions

- `skip_identical` `docs/plans/` — directory exists
- `skip_identical` `docs/waivers/` — directory exists
- `skip_identical` `docs/metrics/` — directory exists
- `skip_identical` `.grok/docs/coverage-policy.md`
- `skip_identical` `.grok/docs/plan-quality-standards.md`
- `skip_identical` `.grok/docs/privacy-safety.md`
- `skip_identical` `.grok/docs/test-accuracy-standards.md`
- `skip_identical` `.grok/docs/ui-design-standards.md`
- `skip_identical` `.grok/personas/gf-backend.toml`
- `skip_identical` `.grok/personas/gf-frontend.toml`
- `skip_identical` `.grok/personas/gf-plan-reviewer.toml`
- `skip_identical` `.grok/personas/gf-qa.toml`
- `skip_identical` `.grok/personas/instructions/gf-backend.md`
- `skip_identical` `.grok/personas/instructions/gf-frontend.md`
- `skip_identical` `.grok/personas/instructions/gf-plan-reviewer.md`
- `skip_identical` `.grok/personas/instructions/gf-qa.md`
- `skip_identical` `.grok/README.md`
- `skip_identical` `.grok/roles/gf-backend.toml`
- `skip_identical` `.grok/roles/gf-frontend.toml`
- `skip_identical` `.grok/roles/gf-plan-reviewer.toml`
- `skip_identical` `.grok/roles/gf-qa.toml`
- `skip_identical` `.grok/rules/accuracy-coverage.md`
- `skip_identical` `.grok/rules/spawn.md`
- `skip_identical` `.grok/skills/install-agentic-team/SKILL.md`
- `skip_identical` `.grok/skills/parallel-fullstack-feature/SKILL.md`
- `skip_identical` `.grok/skills/plan-review-loop/SKILL.md`
- `skip_identical` `.grok/skills/post-change-accuracy-protocol/SKILL.md`
- `skip_identical` `.grok/skills/regression-test-loop/SKILL.md`
- `skip_identical` `.grok/skills/targeted-unit-test-loop/SKILL.md`
- `skip_identical` `.grok/workflows/post-change-testing-protocol.md`
- `skip_identical` `fixtures/agentic-template-acceptance/bad-plan.md`
- `skip_identical` `fixtures/agentic-template-acceptance/README.md`
- `skip_identical` `fixtures/agentic-template-acceptance/sample-ui/app.js`
- `skip_identical` `fixtures/agentic-template-acceptance/sample-ui/index.html`
- `skip_identical` `fixtures/agentic-template-acceptance/sample-ui/styles.css`
- `skip_identical` `fixtures/agentic-template-acceptance/seeded-bug-notes.md`
- `skip_identical` `fixtures/agentic-template-acceptance/seeded-design-defect-notes.md`
- `skip_identical` `docs/waivers/README.md`
- `skip_identical` `docs/metrics/README.md`
- `skip_identical` `scripts/prepare_commit_metrics.py`
- `skip_identical` `scripts/record_token_usage.py`
- `skip_identical` `scripts/install_git_hooks.py`
- `skip_identical` `scripts/githooks/pre-commit`
- `skip_identical` `docs/metrics/token-ledger.md` — existing ledger preserved
- `skip_identical` `.git/hooks/pre-commit` — metrics hook
- `backup` `AGENTS.md.bak-before-agentic-template-20260716-20260716-052810` — from AGENTS.md
- `update` `AGENTS.md`

## Next steps

1. Confirm Project Test Commands in root `AGENTS.md` (fill TODOs or write durable waivers).
2. If Coverage is NONE: add tooling or `docs/waivers/` before merge claims coverage gate.
3. Confirm `docs/metrics/token-ledger.md` + `VERSION` exist; **every commit** must run `python scripts/prepare_commit_metrics.py --model … --input N --output M` (or `--unmeasured`). Install hooks: `python scripts/install_git_hooks.py`.
4. Optional: `grok inspect --json` and confirm project skills + spawn rule.
5. Optional: Fixture A — copy `fixtures/agentic-template-acceptance/bad-plan.md` → `docs/plans/acceptance-bad-plan.md` and run `/plan-review-loop` (optional `/cold-review` only if listed in grok inspect).
6. Prefer bundled `/review`, `/check-work`, `/implement` for product work.

## Reminders

- Prepend persona instruction files on every spawn; tags are UI-only.
- Always set `capability_mode` on spawn (QA: execute/all).
- Lead-only spawn (depth 1); see `.grok/rules/spawn.md`.
- Roles/persona defaults are catalog only — not spawn binding.
- Template feature train: 1.7; product `VERSION` patch-bumps every commit
- Never invent token counts; use --unmeasured when stats unavailable
