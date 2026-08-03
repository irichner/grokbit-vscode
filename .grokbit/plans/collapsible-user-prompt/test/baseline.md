# Baseline — collapsible-user-prompt

Captured **before** T2/T3 behavior changes. Suite green: 1516 tests (2026-08-02).

## T2 baseline — user bubble always full height

- Live multi-line `userMessage` renders full text in `.turn-prompt .msg.user .body`.
- `makeCollapsible` exists in `media/chat.js` but is **never called** (skip comment after `addMessage` user path).
- No `.msg.user.collapsible`, no `.msg-expand-btn` on live multi-line sends.
- Replay via `historyReplay` + `userMessageChunk` also shows full body.

## T3 baseline — CSS

- `.msg.user.collapsible .body` uses `max-height: 48px` + gradient `::after` (`media/chat.css` collapsible user messages block).
- `.msg-expand-btn` is `display: none` until `.msg.user.collapsible:hover`.

## T4 baseline

- Full suite 1516 green; turn-container tests pass for sticky/collapse stack.
