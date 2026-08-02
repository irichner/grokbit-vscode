# Assumptions — Phase A: Trust & host stability

## Open / unresolved

| Id | Marker | Statement | Impact if wrong |
|----|--------|-----------|-----------------|
| A1 | UNVERIFIED | `fs/write_text_file` and `terminal/create` never carry `toolCallId` on either backend | If they do, binding could be tighter; path binding still valid |
| A2 | UNVERIFIED | Claude plan artifacts are not written via workspace `fs/write` in a way that breaks a client fs gate during plan mode | May need plan-file allowlist for Claude similar to grok `plan.md` |
| A3 | DECIDED | v1 binds **path/command only**, not content hash | Same-path bait-and-switch remains possible |
| A4 | DECIDED | Grants with **no extractable path/command** do not create scoped grants (no false security) | Unscoped allows behave as today |
| A5 | DECIDED | Empty grant queue allows writes (Agent mode without permission) | Stronger “every write needs grant” is out of scope |
| A6 | OBSERVED | Claude adapter install is already async via `execFileAsync` | Phase A is docs + optional cancel, not rewrite |
| A7 | UNVERIFIED | Cancelling `withProgress` cannot reliably kill in-flight `npm` without process tree APIs | Cancel is best-effort abandon-await |

## Resolved at gate (fill when human approves)

- [ ] Human accepts A3–A5 product semantics
- [ ] Human accepts Claude gets fs/terminal plan gate with permission pre-reject still off
