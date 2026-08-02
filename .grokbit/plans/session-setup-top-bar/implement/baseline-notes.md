# Baseline notes — session-setup-top-bar (pre-change)

Captured before implement (2026-08-02). Complements generic `test/baseline.md`.

## Behaviors that must not regress

| Behavior | Observation | Proven by |
|---|---|---|
| Composer model chip opens quick-settings popover | 4 rows Agent/Model/Thinking/Mode; gear closed | `test/model-chip.dom.test.ts` 14 green at preflight |
| Welcome Session setup card hides on first send | card `hidden` + empty innerHTML | `test/session-setup.dom.test.ts` |
| Claude omits Thinking row | labels Agent/Model/Mode only | same + model-chip |
| Busy locks setup controls | segmented/select disabled while busy | session-setup + model-chip |
| Mid-session access exists via bottom chip | `#model-label` click | model-chip |

## Behaviors that will change

| Behavior | Pre-change | Planned |
|---|---|---|
| Top-of-tab Session setup after first prompt | DOES NOT EXIST | top-bar chip |
| `openSessionSettingsPopover` placement | composer-only `positionPopover` (above) | dual-anchor re-parent + top below-chip |
