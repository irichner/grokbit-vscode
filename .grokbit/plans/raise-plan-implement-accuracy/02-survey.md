# Survey — Raise plan/implement accuracy

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Project Test Commands block | EXISTS | `AGENTS.md:151-158` (markers BEGIN/END PROJECT_TEST_COMMANDS) |
| Coverage command (real) | DOES NOT EXIST (placeholder) | `AGENTS.md:156` — `NONE — no tool in repo` |
| Lint command (real) | DOES NOT EXIST (placeholder) | `AGENTS.md:158` — `NONE — no tool in repo` |
| Unit tests command | EXISTS | `AGENTS.md:155` — `` `npm test` `` |
| Build command | PLACEHOLDER | `AGENTS.md:154` — `TODO — user must fill` |
| Coverage waiver | EXISTS | `docs/waivers/coverage-no-tool.md:1-10` |
| Waiver template / directory | EXISTS | `docs/waivers/README.md:1-19` |
| Accuracy gates rule | EXISTS | `.grok/rules/accuracy-coverage.md:9-19` |
| Coverage policy | EXISTS | `.grok/docs/coverage-policy.md:1-9` |
| Test accuracy standards | EXISTS | `.grok/docs/test-accuracy-standards.md:1-24` |
| Plan quality standards | EXISTS | `.grok/docs/plan-quality-standards.md:7-30` |
| Template `/plan` skill | EXISTS | `.grok/skills/plan/SKILL.md:1-66` |
| Template `/implement` skill | EXISTS | `.grok/skills/implement/SKILL.md:25-149` |
| Suite plan skill (home) | EXISTS | `C:\Users\israe\.grok\skills\grokbit-plan\SKILL.md` (also shipped under `resources/skills/` per CLAUDE.md suite section — not re-opened this pass) |
| Suite workflows product doc | EXISTS | `docs/grokbit-workflows.md:1-27` |
| Agentic WORKFLOW.md | EXISTS | `docs/WORKFLOW.md:1-27` (note distinguishing suite vs agentic template) |
| Stop hook (source of truth in vsix) | EXISTS | `resources/hooks/grok/verify_on_stop.py:1-9`, `GATE_LABELS` Lint+Unit `:51` |
| PTC row parser | EXISTS | `resources/hooks/grok/verify_on_stop.py:67-73` |
| Placeholder skip logic | EXISTS | `resources/hooks/grok/verify_on_stop.py:76-87` |
| Workspace hooks copy | EXISTS | `.grok/hooks/verify_on_stop.py` (mirrors resources; gitignored tree may lag) |
| Vitest config | EXISTS | `vitest.config.ts:1-8` — no coverage key |
| package.json test scripts | EXISTS | `package.json:356-370` — `test`/`test:watch`/`test:perf`/`test:baseline`; **no** `test:coverage` |
| vitest devDependency | EXISTS | `package.json:378` — `"vitest": "^2.1.9"` |
| @vitest/coverage-v8 | DOES NOT EXIST | searched package.json deps; only named in waiver follow-up `docs/waivers/coverage-no-tool.md:9` |
| ESLint / prettier scripts | DOES NOT EXIST | package.json scripts/devDeps (opened scripts block) |
| Typecheck as release lint | EXISTS | `scripts/release.ps1:69` — `npx tsc -p . --noEmit`; `CLAUDE.md:285` |
| compile script | EXISTS | `package.json:357` — `"compile": "tsc -p ."` |
| Hook unit tests (JS mirror) | EXISTS | `test/grok-hooks-policy.test.ts:69-109` — fixture AGENTS with NONE lint |
| Client-gates plan (non-goal for accuracy-in-TS) | EXISTS | `docs/plans/client-gates-and-cross-backend-review.md:28-30` |
| Prior session handoff | EXISTS | `.grokbit/handoff.md:1-14` — **other slug** (`workflow-details-inspector`); not this work |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- **Stop gate PTC extraction** — `resources/hooks/grok/verify_on_stop.py:67-100` — already skips `NONE`/`TODO` and will pick up a real Lint command the moment `AGENTS.md` changes; no hook rewrite required for Lint enablement.
- **Release typecheck** — `scripts/release.ps1:69` / `package.json:357` — `tsc` is the project’s real static check; maps cleanly to Lint row without new tooling.
- **Coverage waiver follow-up text** — `docs/waivers/coverage-no-tool.md:9-10` — already names `@vitest/coverage-v8` + REAL Coverage command + remove waiver.
- **Dual-pipeline note (partial)** — `docs/WORKFLOW.md:3-7` already says WORKFLOW is agentic template loop, not the five Grokbit Actions skills; points at `docs/grokbit-workflows.md`.
- **Accuracy protocol order** — `.grok/skills/implement/SKILL.md:132-148` — keep as SoT; do not reimplement.
- **Coverage ladder** — `.grok/docs/coverage-policy.md:3-9` — document which rung vitest provides (whole-package unless changed-line tooling added).

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Coverage `NONE` row | `AGENTS.md:156` | Stop hook skips it; QA records NO TOOL; waiver active | Real Coverage command makes NONE + “no tool” waiver obsolete |
| Lint `NONE` row | `AGENTS.md:158` | Stop skips Lint; accuracy gate soft | Real Lint makes placeholder obsolete |
| `docs/waivers/coverage-no-tool.md` claim “no coverage tooling” | full file | Merge decisions / install note | Tooling install expires the waiver (`:10`) |
| Ambiguous “which plan skill” for humans | docs split WORKFLOW vs grokbit-workflows | operators | Needs explicit when-to-use matrix (partial COEXIST today) |

## Prior attempts
- `docs/waivers/coverage-no-tool.md` (2026-07-16) — accepted gap at agentic-team install; follow-up never executed.
- `docs/plans/client-gates-and-cross-backend-review.md` — proposes client ACP enforcement; **explicit non-goal** of reimplementing accuracy protocol in TS (`:30`). Live hooks already exist for Lint+Unit once rows are real.
- No prior commit adding `@vitest/coverage-v8` found in package.json.

## Conventions
How this repo actually works, with an example of each.

- **Errors / typecheck:** TypeScript project; release runs `npx tsc -p . --noEmit` — `scripts/release.ps1:69`.
- **Tests:** vitest via `npm test` → `vitest run`, include `test/**/*.test.ts` — `package.json:359`, `vitest.config.ts:4-6`.
- **Gates language:** Project Test Commands in `AGENTS.md` between HTML markers; hooks parse `**Label:**` rows — `verify_on_stop.py:49-73`.
- **Accuracy policy location:** `.grok/docs/*` are **reference-only** (must `read_file`) — `.grok/README.md:14` (from prior explore open; reconfirm if needed).
- **Waivers:** durable only under `docs/waivers/` — `docs/waivers/README.md:3`.
- **Plan artifacts (suite):** `.grokbit/plans/<slug>/` — this plan’s tree.
- **Plan artifacts (template):** `docs/plans/<name>.md` — `.grok/docs/plan-quality-standards.md:9-14`.

## Absences
Missing infrastructure the plan may need to add.

- No vitest coverage provider package.
- No `coverage` block in `vitest.config.ts`.
- No `npm run test:coverage` script.
- No ESLint; Lint must be typecheck or new tool.
- No diff-cover / changed-line JS tool in repo.
- Build row still TODO (optional to fill with `npm run compile`).

## Danger zones
- `AGENTS.md` — human-edit-only when hooks trusted (`AGENTS.md` protect_paths note around runtime enforcement section); agents must not neuter PROJECT_TEST_COMMANDS.
- Setting vitest `thresholds` / `fail_under` without baseline can fail every Stop/CI run if whole-package % is low.
- `test/grok-hooks-policy.test.ts` fixtures are independent of live AGENTS — do not “fix” them by coupling to real file unless intentionally testing live parse.
- Dual-stack hooks (`.grok/hooks` + Claude) already a known risk — enabling Lint makes Stop *heavier* (tsc + npm test), not lighter.
- `.grok/` is often gitignored for hooks; source of truth for shipping hooks is `resources/hooks/grok/`.

## Sampling note
Did not open every suite skill under `resources/skills/`; home-tier skill paths and `docs/grokbit-workflows.md` + template skills suffice for dual-pipeline disposition. Did not run coverage (would mutate reports / need install).
