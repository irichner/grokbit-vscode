# Scope audit log — collapsible-user-prompt

## T1 — Pure collapse criterion + unit tests
Reviewed: working tree (uncommitted — dirty-tree mixed WIP)

- `IN_SCOPE` `media/webview-helpers.js` — `USER_PROMPT_COLLAPSE_MIN_CHARS`, `userPromptShouldCollapse`, exported on `api`
- `IN_SCOPE` `test/webview-helpers.test.ts` — import + 4 unit cases
- No `OUT_OF_SCOPE` hunks for T1 intent

### Outcome — T1
Rounds used: 1 of 2. Clean.

## T2 — Wire collapse on live + replay
Reviewed: working tree

- `IN_SCOPE` `media/chat.js` — `makeCollapsible` evolved (idempotent), `applyUserPromptCollapse`, live `addMessage` wire, replay `appendUserChunk` re-apply, helper binding
- `IN_SCOPE` `test/user-prompt-collapse.dom.test.ts` (created)
- No host/ACP changes

### Outcome — T2
Rounds used: 1 of 2. Clean.

## T3 — CSS one-line clamp
Reviewed: working tree

- `IN_SCOPE` `media/chat.css` — line-clamp:1, always-visible expand, removed 48px + hover-only + gradient
- `IN_SCOPE` CSS contract tests in `test/user-prompt-collapse.dom.test.ts`

### Outcome — T3
Rounds used: 1 of 2. Clean.

## T4 — Full suite
Reviewed: no extra production edits beyond T1–T3

- Full `npm test`: **1529 passed** (was 1516 + new tests)
- Turn containers unchanged in behavior (existing tests green)

### Outcome — T4
Clean.
