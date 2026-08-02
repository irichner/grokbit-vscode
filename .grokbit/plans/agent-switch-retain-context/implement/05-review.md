# Scope audit — agent-switch-retain-context

## T1
- `src/agent-handoff.ts` IN_SCOPE
- `test/agent-handoff.test.ts` IN_SCOPE
- No OUT_OF_SCOPE hunks

## T2
- `src/sidebar.ts` switchBackend + executeUserSend await + startSession clear handoffPromise IN_SCOPE
- `src/session.ts` handoffPromise field — undeclared file, necessary; logged in deviations as non-counting
- No opportunistic cleanup

## T3
- `media/chat.js` banner text param IN_SCOPE

## T4
- `docs/plans/claude-code-backend.md` IN_SCOPE

## T5
verification only
