# Plan — Raise plan/implement accuracy

Slug: `raise-plan-implement-accuracy` · Approach: Operational gates (tsc Lint + vitest coverage) + dual-pipeline docs · Blast radius: ~6–8 files, 1 new dep (`@vitest/coverage-v8`), schema no

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Add vitest coverage tooling (no fail_under)
- **intent:** Install and configure coverage so a Coverage command can exist without bricking CI on an unknown baseline.
- **files:** `package.json`, `package-lock.json`, `vitest.config.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm run test:coverage` exits 0 and output includes a coverage summary (lines/statements or table); `npm test` still exits 0.
- **removes:** none
- **baseline:** none (new capability; suite already green without coverage)
- **rollback:** `git revert <commit>` (also remove `coverage/` artifacts if generated and untracked)
- **state-after:** working
- **notes:** Add `@vitest/coverage-v8` as devDependency; script e.g. `"test:coverage": "vitest run --coverage"`; configure `test.coverage` with provider `v8` and include for `src/**` (exclude `test/**`, `out/**` as appropriate). **Do not** set thresholds/`fail_under` in this task. Survey: `vitest.config.ts:1-8`, `package.json:356-378`, waiver follow-up `docs/waivers/coverage-no-tool.md:9`.

### T2 — Record coverage baseline (measurement only)
- **intent:** Capture whole-package coverage % so the team knows ladder rung and whether a future fail_under is safe.
- **files:** `.grokbit/plans/raise-plan-implement-accuracy/implement/coverage-baseline.md` (create under implement/ when implement runs; during plan phase leave path as the intended record — if implement prefers `docs/metrics/coverage-baseline.md`, note deviation)
- **cwd:** none
- **depends:** T1
- **verify:** Baseline file exists and states: command used, date, overall line (or statements) %, provider, and explicit note “changed-line: UNMEASURED / no tool”.
- **removes:** none
- **baseline:** none
- **rollback:** delete baseline file
- **state-after:** working
- **notes:** Prefer writing under this slug’s `implement/` once implement starts. Do not invent %; run `npm run test:coverage`. Per coverage-policy, this is whole-package rung.

### T3 — Wire real Lint + Coverage in AGENTS.md Project Test Commands
- **intent:** Make accuracy gates and Stop hook able to run real Lint; make Coverage a REAL command for QA.
- **files:** `AGENTS.md`
- **cwd:** none
- **depends:** T1
- **verify:** Between `<!-- BEGIN PROJECT_TEST_COMMANDS -->` and `END`, **Lint** line contains `` `npx tsc -p . --noEmit` `` (or equivalent backtick cmd that is not NONE/TODO); **Coverage** line contains `` `npm run test:coverage` `` (not NONE). Run `npx tsc -p . --noEmit` exit 0 on clean tree. Confirm placeholders: PowerShell — content of AGENTS should not match `NONE — no tool` on Lint/Coverage rows.
- **removes:** none (replaces row text only)
- **baseline:** Current rows Lint/Coverage NONE (`AGENTS.md:156-158`) — Stop skips them; after change Lint runs on Stop.
- **rollback:** restore previous AGENTS rows
- **state-after:** working
- **notes:** Build may stay TODO (LEAVE). Do not edit `.grok/hooks` Python. protect_paths may block agent edits to AGENTS when hooks trusted — human may need to apply this task. Stop GATE_LABELS stay Lint+Unit only (`resources/hooks/grok/verify_on_stop.py:51`).

### T4 — Retire coverage-no-tool waiver
- **intent:** End the durable claim that coverage tooling does not exist once T1+T3 land.
- **files:** `docs/waivers/coverage-no-tool.md` (and optionally `docs/waivers/README.md` if it indexes waivers)
- **cwd:** none
- **depends:** T1, T3
- **verify:** File either deleted **or** rewritten with status **Expired/Superseded**, date, and pointer to `npm run test:coverage` + AGENTS Coverage row; must not still claim “no coverage tooling” as current truth.
- **removes:** active “no tool” waiver as a live merge excuse (content replace or delete)
- **baseline:** waiver text at `docs/waivers/coverage-no-tool.md:1-10`
- **rollback:** restore prior waiver file
- **state-after:** working
- **notes:** Expiry condition in waiver `:10` is met by T1+T3. Residual risk if whole-package &lt;80% should be stated in superseded note or T2 baseline, not left as silent gap.

### T5 — Dual-pipeline when-to-use documentation
- **intent:** Operators know whether to run Grokbit suite vs GrokForge `/plan`+`/implement`, and that chat-only plans are invalid under both.
- **files:** `docs/grokbit-workflows.md`, `docs/WORKFLOW.md`
- **cwd:** none
- **depends:** none
- **verify:** `docs/grokbit-workflows.md` contains a when-to-use matrix (or equivalent section) naming both pipelines and “never implement from chat-only”; `docs/WORKFLOW.md` retains/strengthens pointer that it is the agentic template loop and links to suite doc for Actions. Human can answer “which plan skill?” from those two files alone.
- **removes:** none
- **baseline:** none (docs)
- **rollback:** `git revert <commit>`
- **state-after:** working
- **notes:** Survey: `docs/WORKFLOW.md:3-7`, `docs/grokbit-workflows.md:7-27`. Primary matrix in grokbit-workflows; WORKFLOW is pointer. Do not delete either skill tree (COEXIST).

### T6 — Regression: unit suite + typecheck
- **intent:** Prove tooling and doc edits did not break the product test floor or typecheck.
- **files:** none required (verify-only); may touch only if T1 left config bugs
- **cwd:** none
- **depends:** T1, T3, T5
- **verify:** `npm test` exit 0; `npx tsc -p . --noEmit` exit 0; `npm run test:coverage` exit 0.
- **removes:** none
- **baseline:** suite green (handoff reported 1703 tests historically; floor is current main)
- **rollback:** N/A (verify task)
- **state-after:** working
- **notes:** Do not run `test:live` unless releasing. Hook fixture tests in `test/grok-hooks-policy.test.ts` must remain green without requiring live AGENTS to keep NONE.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Real Lint command in AGENTS | T3 verify |
| Real Coverage command in AGENTS | T3 verify |
| package.json + vitest coverage config | T1 verify |
| Waiver retired/superseded | T4 verify |
| Dual-pipeline when-to-use docs | T5 verify |
| npm test + tsc clean | T6 verify |
| Stop can run new Lint (row real, not NONE) | T3 verify (row content) + hooks design (parser already supports real cmds) — optional manual Stop observation |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T3 (Lint NONE, Coverage NONE), T4 (waiver) |
| DEPRECATE | 0 | — |
| COEXIST | 1 | T5 — both pipelines documented, neither removed |
| LEAVE | 1 | Build TODO row in AGENTS (not in done-criteria) |

Net lines: small docs + config; +1 dependency. Not an all-additive feature inventing a second accuracy protocol.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` Lint = tsc noEmit; Coverage = @vitest/coverage-v8; dual pipeline docs-only.
- `UNRESOLVED — Loop 4` Current coverage % until T2.

## Approval
- [x] Human approved — 2026-08-03
