# Scope audit log — actions-survive-agent-switch

## T1 — Stop wiping Grokbit Actions on Agent flip
Reviewed: working tree `media/chat.js` (uncommitted)

- `IN_SCOPE` `media/chat.js` `backendChanged` case — removed clear/hide; flip-only `listCapabilities`; re-render panel/popover
- No `OUT_OF_SCOPE` hunks
- `INCIDENTAL` none beyond wrapping `case` in block for `const prevBackend`

### Outcome — T1
Rounds used: 1 of 2  
Unresolved: none

## T2 — Rewrite regression test
Reviewed: working tree `test/capabilities.dom.test.ts`

- `IN_SCOPE` replaced clear-on-backendChanged test with stay-visible + flip-only re-request + same-backend no-spam + setBusy retain
- No `OUT_OF_SCOPE`

### Outcome — T2
Clean.

## T3 — Full suite
Verification only — no code hunks.

### Outcome — T3
Clean.
