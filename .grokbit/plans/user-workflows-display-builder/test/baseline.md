# Baseline — user-workflows-display-builder (pre-change behavior)

Recorded at implement preflight for regression comparison.

| Surface | Pre-change behavior |
|---|---|
| Workflow tile labels | Raw kebab (`create-workflow`, `review-changes`) |
| Green name color | Only `data-kind="grokbit"` |
| Create Workflow click | Seeded `/create-workflow ` into composer, no auto-send |
| Workflow Builder | Did not exist |
| Suite tiles | Explore/Plan/… labels + green (unchanged target) |
| Claude User Workflows | No synthetic create tile; empty copy points at `.claude/workflows` |

Targeted suite pre-change: 250 tests green (`webview-helpers` + `capabilities.dom`).
