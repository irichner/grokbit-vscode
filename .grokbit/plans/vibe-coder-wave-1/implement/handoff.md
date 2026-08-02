# Handoff — vibe-coder-wave-1 → test

- **Slug:** vibe-coder-wave-1
- **Tasks done:** T1–T6
- **Tasks blocked:** none
- **Commit-per-task:** waived (CLAUDE.md; leave uncommitted)
- **snapshot:** none (dirty tree; no stash — same as phase-a)
- **hand_back_cycle:** 0

## Files touched

| File | Role |
|---|---|
| `src/permission-bind.ts` | contentDigest, hashGrantContent, consumeWriteGrant(path, content, grants) |
| `src/acp.ts` | pass content into bind; use writeBind.reason |
| `src/session.ts` | queueId, pendingSteer |
| `src/sidebar.ts` | queue ack, dequeue, steer, clearPendingUserQueue |
| `media/chat.js` | Queued badge, dequeue/clear, steer keys, placeholders |
| `media/chat.css` | `.msg-queued-badge` |
| `test/permission-bind.test.ts` | content bind cases |
| `test/acp-integration.test.ts` | mismatch/match integration |
| `test/mid-turn-queue.dom.test.ts` | **new** DOM tests |
| `CLAUDE.md` | known-limits honesty |

## Dependencies added

none

## Deviations

See `deviations.md` — only non-counting entry (dirty tree, commit waiver, light baseline).

## Verify evidence

- `npm test` → **1510 passed**, 73 files, exit 0

## What testing should poke hard

1. Allow once Write with content: agent tries different body → blocked notice.
2. Mid-turn Enter: Queued badge appears; after drain badge clears; single bubble.
3. Mid-turn Ctrl+Enter (default keys): cancels + sends new message.
4. Stop clears queued bubbles without sending.
5. Auto-accept still path-only (no content lock).

## Live / rebuild

Uncommitted. User rebuild/reinstall when ready.
