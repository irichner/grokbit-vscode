# Handoff — agent-switch-retain-context → verify

## Tasks
All T1–T5 **done** (commits deferred).

## Files touched
- `src/agent-handoff.ts` (new)
- `test/agent-handoff.test.ts` (new)
- `src/sidebar.ts` — `switchBackend`, handoff await in `executeUserSend`, clear on `startSession`
- `src/session.ts` — `handoffPromise`
- `media/chat.js` — parameterized session-context banner
- `docs/plans/claude-code-backend.md` — non-goal update

## Behavior to smoke manually
1. Open a tab, have a real multi-turn chat, switch Agent → transcript remains; banner “Switched to … — prior conversation applied”; ask “what were we doing?”
2. Hide tab and reveal → transcript still there
3. History list still shows original backend row; new live session on the other backend
4. Empty new tab Agent switch → still transparent, no orphan pile-up
5. Mid-turn switch → blocked with warning

## Verify already run
- `npm test` → **1447 passed**
- `tsc -p . --noEmit` → exit 0

## snapshot
none

## hand_back_cycle
0
