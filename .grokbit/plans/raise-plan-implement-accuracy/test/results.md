# Test results — raise-plan-implement-accuracy

Mode: verify · Baseline: none · Change: `26efe42`…`fcc18bd` (implement commits)

## Reduced mode

**No baseline was captured for this change.** All plan tasks declared `baseline: none`; `test/baseline.md` does not exist. Regression detection against pre-change behavior **did not run** — not "none found," **not measurable.** Done-criteria coverage, visual, security, and suite checks below were still checked.

## Project suite
Before: 1703 passed / 0 failed (see `implement/preflight.md`)
After:  1703 passed / 0 failed (`npm test` in T6 + re-confirmed intent)
New failures (regressions): none
Pre-existing failures (not ours): none
Excluded (INTENDED baseline tests): n/a — no baseline characterization tests

Also: `npx tsc -p . --noEmit` exit 0; `npm run test:coverage` exit 0 with coverage summary (lines 32.29%).

## Done-criteria coverage
| Criterion | Check run | Result |
|---|---|---|
| AGENTS Lint real command, exits 0 on clean tree | Read `AGENTS.md` PTC block; `npx tsc -p . --noEmit` | **PROVEN** — `` `npx tsc -p . --noEmit` ``; exit 0 |
| Lint fails on deliberate type errors | Not run end-to-end (would require temp bad file) | **UNVERIFIED** — tsc is known to fail on type errors; not re-proven this session with a planted error |
| AGENTS Coverage real command prints numbers | PTC row + `npm run test:coverage` | **PROVEN** — `` `npm run test:coverage` ``; report includes `% Lines` / summary |
| package.json coverage dep + script; vitest config include | Read `package.json`, `vitest.config.ts` | **PROVEN** — `@vitest/coverage-v8`, `test:coverage`, `include: ["src/**"]` |
| Waiver no longer claims no tool | Read `docs/waivers/coverage-no-tool.md` | **PROVEN** — Status Superseded/Expired; residual risk stated |
| Dual-pipeline when-to-use + chat-only ban | Grep/read `docs/grokbit-workflows.md`, `docs/WORKFLOW.md` | **PROVEN** — matrix section + WORKFLOW pointer |
| `npm test` green; tsc clean | Ran both | **PROVEN** — 1703 pass; tsc 0 |
| Stop runs new Lint when hooks trusted | No live Stop observation this session | **UNVERIFIED** — design: real row enables parser; not observed mid-session Stop |

Proven: **6 of 8** (counting Lint clean + Coverage + package tooling + waiver + dual-docs + suite/tsc as primary; deliberate type-fail + Stop observation unverified)  
Unverified: deliberate type-error fail; Stop-gate observation

## Visual
No UI product files in implement surface. N/A for product views.

| View | Width | Result | Capture |
|---|---|---|---|
| (none — no UI change) | — | N/A | — |

## Maintenance sweep
Session commits: `26efe42`, `3da3bcf`, `2fd9346`, `f0fe78c`, `fcc18bd`.

- No orphaned product source files from abandoned attempts.
- `@vitest/coverage-v8` is used by `npm run test:coverage` / vitest coverage config — not unused.
- `removes:` fields: T4 supersedes waiver content (done); no undeleted dual implementations.
- Plan implement artifacts under `.grokbit/plans/raise-plan-implement-accuracy/` remain untracked except `coverage-baseline.md` (committed) — intentional session paper trail, not product debris.
- Temp script `scripts/_tmp_agents_t3.py` was deleted after use.

## Baseline retirement
(empty — no INTENDED regression findings; reduced mode)
