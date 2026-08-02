# Handoff — markdown-document-cards → grokbit-test

## Done
- All tool-result document auto-cards disabled (every former kind).
- Kind classification + Docs browser unchanged.
- Webview renderer left for historical buffer messages.

## Files touched
- `src/acp-dispatch.ts`
- `src/acp.ts`
- `test/business-docs.test.ts`
- `CLAUDE.md`

## Verify
- `npm test` → 1391 passed (2026-08-01)

## Hard checks for test phase
- No new MARKDOWN/WORD/etc. tiles from tool results in a live turn.
- Docs popover still classifies/lists business paths if applicable.
- Media cards and tool rows unchanged.
- Synthetic DOM document-card tests still pass (legacy render).

## Blocked
- none

## Commits
- none (await user)
