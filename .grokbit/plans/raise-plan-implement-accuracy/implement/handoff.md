# Implement handoff — raise-plan-implement-accuracy

Input contract for `grokbit-test` verify mode.

## Completed
- T1 `26efe42` — Add vitest coverage tooling (no fail_under)
- T2 `3da3bcf` — Record coverage baseline (measurement only)
- T3 `2fd9346` — Wire real Lint + Coverage in AGENTS.md Project Test Commands
- T4 `f0fe78c` — Retire coverage-no-tool waiver (superseded)
- T5 `fcc18bd` — Dual-pipeline when-to-use documentation
- T6 verify-only — Regression: `npm test` + `tsc` + `test:coverage` all exit 0 (1703 tests)

## Blocked
- none

## Surface changed
Files: `package.json`, `package-lock.json`, `vitest.config.ts`, `AGENTS.md`, `docs/waivers/coverage-no-tool.md`, `docs/grokbit-workflows.md`, `docs/WORKFLOW.md`, `.grokbit/plans/raise-plan-implement-accuracy/implement/coverage-baseline.md`, `VERSION`, `docs/metrics/token-ledger.md`
Endpoints added/changed: none
Schema changes: none
UI views affected: none
Dependencies added: `@vitest/coverage-v8@^2.1.9` (devDependency)

## Look here hard
- **Coverage report quality:** text report lists some modules twice (high % + 0%); aggregate **32.29% lines** is whole-package rung — do not fail_under yet.
- **AGENTS.md Stop gate:** Lint is now real (`tsc --noEmit`). Confirm hook fixture tests still green without requiring live AGENTS to stay NONE (T6 green).
- **Waiver residual risk:** changed-line still UNMEASURED; low whole-package % must not be read as ≥80% gate met.
- **Dual-pipeline docs:** matrix + chat-only ban only; no skill tree deleted.

## Deviations
See `deviations.md` — 1 recorded (`counts: no`).

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| stash | `pre-implement snapshot raise-plan-implement-accuracy` (tracked: package.json, token-metrics.ts, token-usage.json) | **yes** — `git stash pop` clean auto-merge on package.json |

Untracked WIP left in tree during implement (features docs/scripts, plan artifacts) — not in stash.

## Baseline reference
NOT CAPTURED as `test/baseline.md` — all tasks declared `baseline: none`. Coverage measurement recorded in `implement/coverage-baseline.md`.

## hand_back_cycle
0
