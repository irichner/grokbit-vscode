# Scope audit — markdown-document-cards

## T1
- `src/acp-dispatch.ts` — IN_SCOPE (extract disable + remove dead path-scan helpers only used by extract)
- `src/acp.ts` — IN_SCOPE (plan listed optional emit no-op; removed unused imports/de-dupe map as INCIDENTAL cleanup of dead state after no-op)
- `test/business-docs.test.ts` — IN_SCOPE

## T2
- `CLAUDE.md` — IN_SCOPE

## T3
- verify only

No OUT_OF_SCOPE hunks retained.
