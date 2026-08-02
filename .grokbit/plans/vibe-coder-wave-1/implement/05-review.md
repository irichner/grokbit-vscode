# Scope audit — vibe-coder-wave-1

## T1
- `src/permission-bind.ts` — IN_SCOPE
- `test/permission-bind.test.ts` — IN_SCOPE
- OUT_OF_SCOPE: none

## T2
- `src/acp.ts` consumeWriteGrant call — IN_SCOPE
- `test/acp-integration.test.ts` content bind cases — IN_SCOPE
- OUT_OF_SCOPE: none

## T3 + T4 (shared host/webview surface)
- `src/session.ts` pendingUserSends.queueId, pendingSteer — IN_SCOPE
- `src/sidebar.ts` queue/steer/clear — IN_SCOPE
- `media/chat.js` badge, shortcuts, placeholders — IN_SCOPE
- `media/chat.css` badge styles — IN_SCOPE
- `test/mid-turn-queue.dom.test.ts` — IN_SCOPE
- INCIDENTAL: cancel path `suppressTurnTail = true` (aligns with design Stop/steer; improves cancelled-stream drop)
- OUT_OF_SCOPE: none

## T5
- `CLAUDE.md` known-limits bullets — IN_SCOPE
- OUT_OF_SCOPE: none

## T6
- CSS comment wording fix so chat-layout `@media` count stays 2 — INCIDENTAL (verify fix, not feature)

Outcome: clean for commit when user chooses to commit.
