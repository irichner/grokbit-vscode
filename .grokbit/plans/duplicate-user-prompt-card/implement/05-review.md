# Scope audit log — duplicate-user-prompt-card

Append-only, one section per task. Never overwrite a previous task's entry.

## T1 — Hide active turn header; assert single visible prompt
Reviewed: working tree diff vs `implement/snapshots/*.start` (no git commit — project policy)

- `IN_SCOPE` `media/chat.css` — `.turn.active .turn-header { display: none; }` replaces prior active-header cursor/border chrome; serves dual-prompt fix intent
- `IN_SCOPE` `test/chat-turn-containers.dom.test.ts` — CSS contract + single `.msg.user` assert; collapse still checks prior header reappears without `.active`
- `OUT_OF_SCOPE` — none
- `INCIDENTAL` — none beyond imports needed for `readFileSync` / `ruleBlock` in the test file

### Round 2
Not needed.

## Outcome — T1
Rounds used: 1 of 2  
Unresolved at cap: none

## T2 — Full suite green
Reviewed: no production/test edits beyond T1; verify only

Clean. Zero hunks. Full suite 1392 passed. Nothing to revert or promote.

## Outcome — T2
Rounds used: 1 of 2  
Unresolved at cap: none
