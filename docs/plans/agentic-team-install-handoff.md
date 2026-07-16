# Agentic team install handoff

- **Date:** 2026-07-16
- **Template version:** 1.7
- **git_mode:** full
- **Companion rules (unchanged):** CLAUDE.md

## Project Test Commands status

Installer scan, then **Lead-corrected** from `CLAUDE.md` + `package.json`:

- **Build:** REAL — `npm run compile` (was TODO; package.json uses `compile` not `build`)
- **Unit tests:** REAL — `npm test` (vitest, grok-free)
- **Coverage:** NONE — durable waiver `docs/waivers/coverage-no-tool.md`
- **Regression / full suite:** REAL — `npm test` (+ CI package; extended: `npm run test:live` pre-release — **not** Playwright; installer false-positive fixed)
- **Lint:** REAL — `tsc -p . --noEmit` (typecheck; no ESLint)

## Actions

- `mkdir` `docs/plans/`
- `mkdir` `docs/waivers/`
- `mkdir` `docs/metrics/`
- `create` `.grok/docs/coverage-policy.md`
- `create` `.grok/docs/plan-quality-standards.md`
- `create` `.grok/docs/privacy-safety.md`
- `create` `.grok/docs/test-accuracy-standards.md`
- `create` `.grok/docs/ui-design-standards.md`
- `create` `.grok/personas/gf-backend.toml`
- `create` `.grok/personas/gf-frontend.toml`
- `create` `.grok/personas/gf-plan-reviewer.toml`
- `create` `.grok/personas/gf-qa.toml`
- `create` `.grok/personas/instructions/gf-backend.md`
- `create` `.grok/personas/instructions/gf-frontend.md`
- `create` `.grok/personas/instructions/gf-plan-reviewer.md`
- `create` `.grok/personas/instructions/gf-qa.md`
- `create` `.grok/README.md`
- `create` `.grok/roles/gf-backend.toml`
- `create` `.grok/roles/gf-frontend.toml`
- `create` `.grok/roles/gf-plan-reviewer.toml`
- `create` `.grok/roles/gf-qa.toml`
- `create` `.grok/rules/accuracy-coverage.md`
- `create` `.grok/rules/spawn.md`
- `create` `.grok/skills/install-agentic-team/SKILL.md`
- `create` `.grok/skills/parallel-fullstack-feature/SKILL.md`
- `create` `.grok/skills/plan-review-loop/SKILL.md`
- `create` `.grok/skills/post-change-accuracy-protocol/SKILL.md`
- `create` `.grok/skills/regression-test-loop/SKILL.md`
- `create` `.grok/skills/targeted-unit-test-loop/SKILL.md`
- `create` `.grok/workflows/post-change-testing-protocol.md`
- `create` `fixtures/agentic-template-acceptance/bad-plan.md`
- `create` `fixtures/agentic-template-acceptance/README.md`
- `create` `fixtures/agentic-template-acceptance/sample-ui/app.js`
- `create` `fixtures/agentic-template-acceptance/sample-ui/index.html`
- `create` `fixtures/agentic-template-acceptance/sample-ui/styles.css`
- `create` `fixtures/agentic-template-acceptance/seeded-bug-notes.md`
- `create` `fixtures/agentic-template-acceptance/seeded-design-defect-notes.md`
- `create` `docs/waivers/README.md`
- `create` `docs/metrics/README.md`
- `create` `scripts/prepare_commit_metrics.py`
- `create` `scripts/record_token_usage.py`
- `create` `scripts/install_git_hooks.py`
- `create` `scripts/githooks/pre-commit`
- `create` `docs/metrics/token-ledger.md` — seed empty ledger
- `create` `VERSION` — seed from template
- `update` `.git/hooks/pre-commit` — metrics hook installed
- `backup` `AGENTS.md.bak-before-agentic-template-20260716` — from AGENTS.md
- `update` `AGENTS.md`

## Post-install corrections (done)

1. Project Test Commands filled for Node/vitest VS Code extension.
2. Coverage waiver written: `docs/waivers/coverage-no-tool.md`.
3. Pre-commit metrics hook installed; `VERSION` seeded `0.1.0` (product version still lives in `package.json`).
4. Existing `.grok/config.toml` (MCP workspace config) left in place — not part of template tree.
5. Previous minimal `AGENTS.md` backed up to `AGENTS.md.bak-before-agentic-template-20260716`.

## Next steps

1. Optional: `grok inspect --json` and confirm project skills + spawn rule (verify already ran).
2. Optional: Fixture A — copy `fixtures/agentic-template-acceptance/bad-plan.md` → `docs/plans/acceptance-bad-plan.md` and run `/plan-review-loop`.
3. Prefer bundled `/review`, `/check-work`, `/implement` for product work.
4. On product commits: prepare metrics updates `VERSION` + `docs/metrics/token-ledger.md` (hook installed).

## Reminders

- Prepend persona instruction files on every spawn; tags are UI-only.
- Always set `capability_mode` on spawn (QA: execute/all).
- Lead-only spawn (depth 1); see `.grok/rules/spawn.md`.
- Roles/persona defaults are catalog only — not spawn binding.
- Template feature train: 1.7; product `VERSION` patch-bumps every commit
- Never invent token counts; use --unmeasured when stats unavailable
