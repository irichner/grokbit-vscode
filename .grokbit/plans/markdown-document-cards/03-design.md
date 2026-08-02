# Design — Disable tool-result document cards

## Context

Document cards were Business Studio v1: completed tool results with business-doc paths → permanent chat cards. User confirmed **all** kinds are noise (Markdown **and** Word/Excel/PowerPoint/PDF/CSV).

## Options (updated)

### Option A — Partial kind allowlist (markdown/text off, Office on)
**Rejected** by user follow-up.

### Option B — Write-only tool-kind filter
**Rejected** — still noisy; not requested.

### Option C — Disable all tool-result document auto-cards (**chosen**)

Stop producing new `{type:"document"}` / `documentContent` events from the live tool pipeline.

**Pros:** Matches user request exactly; ends all mid-response tiles of this family; small change.  
**Cons:** No one-click card after `/docx` etc.; Open/Reveal remains available via other surfaces if needed later. Acceptable for thin coding client.

### Option D — Delete renderer + CSS + host handlers entirely
Larger blast radius; breaks historical replay of buffered document messages; not required to stop new cards.

## Decision

**Option C**, implemented at the **pure extract choke point** so every caller of `extractBusinessDocumentPaths` yields no card refs:

1. **`extractBusinessDocumentPaths` always returns `[]`** (or early-return at top), with JSDoc: *tool-result document cards disabled; classification remains on `businessDocKindForPath` for Docs/open strategy.*
2. Optionally also no-op `emitToolBusinessDocs` for defense-in-depth (same product effect if extract is empty). Prefer **both**: extract empty + short-circuit emit so future re-enable is one place.
3. **Leave** `businessDocKindForPath`, `businessDocLabel`, `openStrategyForKind`, `BUSINESS_DOC_EXT` — used by workspace-docs and open paths.
4. **Leave** webview `addDocumentCard` + CSS + DOM tests that dispatch synthetic `document` messages — they document the **legacy/replay** renderer, not live emission. Activity-carousel segment-break tests that inject a document message remain valid (renderer still breaks segments if a message arrives).
5. **Update** unit tests: all former extract positives become “returns []”; keep kind-classifier tests green.
6. **Update** CLAUDE.md: document cards no longer auto-surface from tool results.

### Alternative considered then dropped

Partial allowlist (`isBusinessDocumentCardKind`) — superseded by full disable; do **not** add a half-empty allowlist helper unless re-enable is planned soon. Prefer dead-simple empty extract over a permanent empty set.

## Disposition table

| Item | Disposition | Reason |
|---|---|---|
| Live tool-result → document card (all kinds) | **REPLACE** | Disabled; no replacement UI required |
| `extractBusinessDocumentPaths` card production | **REPLACE** | Always `[]` (or equivalent no-op) |
| `emitToolBusinessDocs` | **REPLACE** or **LEAVE** as thin no-op shell | Prefer early-return for clarity |
| `businessDocKindForPath` + workspace-docs | **LEAVE** | Still classifies paths for Docs browser |
| Webview `.document-card` renderer | **LEAVE** | Historical buffer/replay; dead-code cleanup out of scope |
| Original `docs/plans/business-documents.md` | **LEAVE** | Historical SoT of shipped-then-disabled feature |
| Generated media cards | **LEAVE** | Unrelated |

## Risks

| Risk | Mitigation |
|---|---|
| User later wants Office cards back | Re-enable extract body from git; pure tests re-invert |
| Docs browser broken if kinds removed | Do not touch `businessDocKindForPath` map |
| Tests still assert live Office cards from extract | Invert in T1 |
