# Progress — session-setup-top-bar

| Task | Status | Attempts | Commit | Created | Cost | Notes |
|---|---|---|---|---|---|---|
| T1 | done | 1 | deferred | none | — | dual-anchor open + positionSessionSettingsFromTop |
| T2 | done | 1 | deferred | none | — | sessionSetupChipLabel + 4 unit tests |
| T3 | done | 1 | deferred | none | — | chip shell/CSS/wire/truth table |
| T4 | done | 1 | deferred | `test/session-setup-chip.dom.test.ts` | — | 10 DOM tests green |
| T5 | done | 1 | deferred | none | — | README + CLAUDE one-liners |

## Blocked task detail
(none)

## Dependency verdicts
(none — no new packages)

## Verify summary
- T1: `model-chip.dom.test.ts` 14 pass
- T2: `webview-helpers.test.ts` 171 pass (incl. chip label)
- T3: session-setup + model-chip + chat-layout green
- T4: session-setup-chip 10 + session-setup + model-chip green
- Extra regression: capabilities/backend/friendly-ui/chat-layout green
