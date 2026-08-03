# Implement handoff — collapsible-user-prompt

Input contract for `grokbit-test` verify mode.

## Completed
- T1 — pure `userPromptShouldCollapse` + unit tests
- T2 — live + replay wire of Show more/less on long user prompts
- T3 — CSS one-line clamp, always-visible expand
- T4 — full suite green (1529)

## Blocked
None.

## Surface changed
Files:
- `media/webview-helpers.js` — `USER_PROMPT_COLLAPSE_MIN_CHARS`, `userPromptShouldCollapse`
- `media/chat.js` — `makeCollapsible` / `applyUserPromptCollapse`, addMessage + appendUserChunk
- `media/chat.css` — collapsible user message rules
- `test/webview-helpers.test.ts` — unit coverage
- `test/user-prompt-collapse.dom.test.ts` — new DOM suite

Endpoints: none  
Schema: none  
UI: session chat user bubbles (active sticky + expanded prior prompts)  
Dependencies added: none

## Look here hard
- Live multi-line send: one-line clamp + Show more without hover
- Expand / Show less round-trip
- Short prompts unchanged
- Replay `historyReplay` + multi-line `userMessageChunk`
- Prior-turn accordion still collapses on second send
- Font scale (`zoom`) — line-clamp should still look like one line

## Deviations
See `deviations.md` — 0 counting; dirty-tree commit deferral waived.

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| none | proceeded dirty (overlapping WIP) | n/a |

## Baseline reference
Captured: `test/baseline.md` (plan-local)

## hand_back_cycle
0

## Commits
Not created in this session (mixed dirty tree). Suggested single commit when tree is ready:

```
feat(chat): collapse long user prompts to one line

Show more/less on multi-line or long prompts; keep short prompts full.
Live + replay parity; turn containers unchanged.
```

Stage only:
- media/webview-helpers.js
- media/chat.js
- media/chat.css
- test/webview-helpers.test.ts
- test/user-prompt-collapse.dom.test.ts
- .grokbit/plans/collapsible-user-prompt/**
