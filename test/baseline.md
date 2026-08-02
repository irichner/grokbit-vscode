# Baseline — chat-turn-containers (pre-change)

Captured before implement of turn-container chat UX (2026-08-01).

## Behaviors that will change

| Behavior | Pre-change observation | Proven by |
|---|---|---|
| Transcript layout | Flat children of `#messages` (user/agent/tool/activity rows) | `media/chat.js` addMessage / ensureActivityBlock append to `messagesEl` |
| Activity on turn end | Multi-batch freezes to `.activity-carousel.done` summary; single-batch unwraps to tool-group | `test/activity-carousel.dom.test.ts` (pre-change) |
| Late tool updates after freeze | Still attach to frozen/unwrapped rows | same |
| Sticky user prompt | None | `media/chat.css` `.messages` only |
| Prior turn collapse | Only long user-prompt body `makeCollapsible` | `media/chat.js` makeCollapsible |
| Final surface | Prompt + tools/activity summary + answer all remain | product |

## Behaviors that must not regress

| Behavior | Observation |
|---|---|
| Permission / plan / question cards actionable | DOM tests green |
| Primer-only restore keeps welcome | `test/primer-only-restore.dom.test.ts` |
| Full suite grok-free | `npm test` 1347 green at start |
