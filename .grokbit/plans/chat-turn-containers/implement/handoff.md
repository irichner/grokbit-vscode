# Handoff — chat-turn-containers → grokbit-test

## Tasks

All T1–T6 **done**. Verify: `npm test` → **1356 passed** (was 1347).

## What shipped

Turn-container chat UX in the webview:

1. Each user prompt opens a `.turn` with sticky `.turn-prompt` while active.
2. Live agent work is a single-line carousel under `.turn-activity` (classic list when `compactActivity` off).
3. On seal (`promptComplete` / `commitAgentTurn`), intermediate tools/thinking/activity are **destroyed**; prompt + final answer remain.
4. Next user message collapses the prior turn; header expands to show prior answer again.
5. Replay builds the same structure; interactive cards and plan/permission history still work.

## Files touched

- `media/chat.js`, `media/chat.css`
- `test/chat-turn-containers.dom.test.ts` (new)
- Updated: `activity-carousel`, `tool-summary`, `card-collapse-tasks`, `plan-history-restore`, `tool-edit-expand`, `tool-output-expand` DOM tests
- `test/baseline.md`

## Dependencies

None.

## Deviations

1. Resolved permission/question cards are **kept** (not stripped) on seal — required for restore/history.

## Not committed

Per project rules, no auto-commit. Working tree has the implementation uncommitted (plus `.grokbit/` plan tree).

## Test focus for grokbit-test

- DC1–DC6 via `test/chat-turn-containers.dom.test.ts`
- Full `npm test`
- Manual: sticky prompt under `grok.chatFontScale` ≠ 100% in real VS Code (`UNVERIFIED` in assumptions)
