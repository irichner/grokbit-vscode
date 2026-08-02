# Plan — Disable all tool-result document cards

Slug: `markdown-document-cards` · Approach: Option C — no auto-cards for any business-doc kind · Blast radius: ~3–5 files, 0 deps, no schema

## Why this exists (user-facing answer)

**They appeared because** completed tool results were scanned for paths with business extensions; each match became a permanent document card (kind chip + name + actions). CSS uppercased the kind → **MARKDOWN**, **WORD**, etc.

**They stayed because** cards were buffered deliverables on the answer surface, not activity-carousel chrome.

**Product decision (updated):** stop auto-carding **all** former kinds — Markdown/Text **and** Word / Excel / PowerPoint / PDF / CSV. Docs browser classification stays; only live tool-result cards go away.

## Tasks

### T1 — Disable extract (and harden emit)
- **intent:** No tool-result path of any former business-doc kind becomes a document-card candidate.
- **files:** `src/acp-dispatch.ts`, `src/acp.ts` (optional early-return in `emitToolBusinessDocs`), `test/business-docs.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/business-docs.test.ts`
- **removes:** none required (behavior off; keep type helpers). Do **not** delete `businessDocKindForPath` / ext map.
- **baseline:** Today extract returns refs for docx/xlsx/md/etc. from tool content (`test/business-docs.test.ts`). After change, extract always `[]` for those inputs; kind helper tests still pass.
- **rollback:** restore extract body + emit from git
- **state-after:** working
- **notes:**
  - Preferred: `extractBusinessDocumentPaths` early-returns `[]` with JSDoc that tool-result document cards are disabled; classification lives on `businessDocKindForPath`.
  - Defense-in-depth: `emitToolBusinessDocs` early-returns without emitting (comment: cards disabled).
  - Invert all extract **positive** cases to expect `[]`; keep negatives; keep `businessDocKindForPath` / label / openStrategy tests.
  - Do **not** implement a partial allowlist — full disable only.

### T2 — Project map + confirm renderer LEAVE
- **intent:** Docs match product; DOM/carousel tests that **synthesize** `document` messages still pass (legacy render path).
- **files:** `CLAUDE.md` (business document card bullet under chat surfaces)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/business-docs.test.ts test/business-docs.dom.test.ts test/activity-carousel.dom.test.ts`
- **removes:** none
- **baseline:** none (docs)
- **rollback:** restore CLAUDE.md wording
- **state-after:** working
- **notes:** State clearly that **live** tool-result document cards are disabled; webview may still render historical buffered `document` messages. Do not delete `addDocumentCard` in this plan.

### T3 — Full suite gate
- **intent:** No regressions elsewhere.
- **files:** none
- **cwd:** none
- **depends:** T1, T2
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** n/a
- **state-after:** working
- **notes:** —

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Explain appear + stay | Plan preamble / gate |
| No new card for any former kind (Office + md + text + csv) | T1 extract always empty + T3 |
| Media / tool rows / changed-files untouched | T3 (no intentional edits there) |
| `businessDocKindForPath` still classifies | T1 kind tests |
| Suite green | T1–T3 |
| CLAUDE.md accurate | T2 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 | T1 (extract card production; live emit) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 4 | kind map, webview renderer, historical plan doc, media pipeline |

Net lines: small negative or near-zero (early returns + test invert).

## Open assumptions
See `assumptions.md`.

- Historical replay may still show old cards — accepted.
- No setting to re-enable — product off until a future plan.

## Approval
- [x] Human approved — 2026-08-01
