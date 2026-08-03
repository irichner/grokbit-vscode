# Scope audit — product-review-remediation

## T1 M1
- `IN_SCOPE` `media/webview-helpers.js` — `isSafeHref`
- `IN_SCOPE` `media/chat.js` — markdown link gate
- `IN_SCOPE` tests

## T2 M2
- `IN_SCOPE` `src/env-filter.ts` + `test/env-filter.test.ts`
- Non-secret `GROK_CLAUDE_SKILLS_ENABLED` still allowed from .env (documented in test)

## T3 M3
- `IN_SCOPE` `media/chat.js` builder keyboard + `test/capabilities.dom.test.ts`

## T4 M4
- `IN_SCOPE` `Claude.md` Known limits + What's next

OUT_OF_SCOPE: none.
