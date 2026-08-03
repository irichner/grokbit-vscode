# Plan — Product review remediation (M1–M4)

Slug: `product-review-remediation` · Source: `.grokbit/plans/complete-code-review/findings.md`  
Blast radius: `media/chat.js`, `media/webview-helpers.js`, `src/env-filter.ts`, tests, `Claude.md`

## Tasks

### T1 — M1 safe markdown hrefs
- **intent:** Reject dangerous URL schemes in markdown links; unit + DOM regression
- **files:** `media/webview-helpers.js`, `media/chat.js`, `test/webview-helpers.test.ts`, `test/webview-ui.dom.test.ts`
- **verify:** `npx vitest run test/webview-helpers.test.ts test/webview-ui.dom.test.ts`
- **removes:** none
- **baseline:** none
- **rollback:** revert files

### T2 — M2 deny XAI/Grok secrets in workspace .env
- **intent:** filterDotEnv drops XAI_* and grok credential env names
- **files:** `src/env-filter.ts`, `test/env-filter.test.ts`
- **verify:** `npx vitest run test/env-filter.test.ts`
- **removes:** none
- **baseline:** none
- **rollback:** revert files

### T3 — M3 Workflow Builder Escape + focus trap
- **intent:** Escape closes builder (with dirty confirm); Tab cycles inside dialog; aria-modal
- **files:** `media/chat.js`, `test/capabilities.dom.test.ts`
- **verify:** `npx vitest run test/capabilities.dom.test.ts`
- **removes:** none
- **baseline:** none
- **rollback:** revert files

### T4 — M4 Known limits honesty + full suite
- **intent:** Fix Claude.md workflows deferred claim; clarify E6 vs ADR 0004; full suite green
- **files:** `Claude.md`
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** revert Claude.md

## Approval

- [x] Human approved — 2026-08-02 (via `/grokbit-implement M1-M4`)
