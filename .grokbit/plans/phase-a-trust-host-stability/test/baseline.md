# Baseline — phase-a-trust-host-stability (pre-change)

Captured 2026-08-01 before implement.

## Behaviors that will change (INTENDED)

| Behavior | Pre-change observation | Plan cite |
|---|---|---|
| Write after allow for path A can write path B | `fsWrite` writes any path after plan-gate; no grant store | `03-design.md` Option 1 |
| Claude plan mode: no client fs/terminal gate | `CLAUDE_BACKEND.quirks.clientPlanGate === false` | Design: split quirks, Claude fs on |
| Grok CLI update tears down Claude tabs | `disposePool()` unfiltered + all panels restarted | T4 |
| Synthetic permission diffs unlabeled | `chat.js` uses `permissionDiffFromRawInput` with no badge | T5 |
| CLAUDE.md claims sync Claude install | Known limits text | T6 (docs only; code already async) |

## Behaviors that must not regress

| Behavior | Observation |
|---|---|
| Grok plan-gate blocks workspace writes when planActive | `test/plan-gate.test.ts` green |
| Empty permission grants do not block Agent writes | Non-goal; Agent writes without prior permission |
| Permission card collapse / replay | `test/card-collapse-tasks.dom.test.ts`, `test/permission-card.dom.test.ts` |
| backends: grok quirks still enable primer/media/xai | `test/backends.test.ts` |
| Full suite | Run `npm test` at preflight |
