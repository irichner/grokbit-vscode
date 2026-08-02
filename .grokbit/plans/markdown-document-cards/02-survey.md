# Survey — Markdown document cards

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Business doc kind union (incl. `markdown`) | EXISTS | `src/acp-dispatch.ts:216-223` |
| Extension → kind map (`.md` → markdown) | EXISTS | `src/acp-dispatch.ts:234-244` |
| Prose path regex for business exts | EXISTS | `src/acp-dispatch.ts:247-254` |
| `extractBusinessDocumentPaths` | EXISTS | `src/acp-dispatch.ts:298-328` |
| `isCompletedToolPayload` gate | EXISTS | `src/acp-dispatch.ts:336-346` |
| `emitToolBusinessDocs` on tool_call / update | EXISTS | `src/acp.ts:548-555`, `585-597` |
| Per-toolCallId de-dupe set | EXISTS | `src/acp.ts:178`, `588-595` |
| Host `documentContent` → buffered `document` message | EXISTS | `src/sidebar.ts:2334-2337`, `1515-1524` |
| Path resolve + existsSync gate (relative only) | EXISTS | `src/sidebar.ts:1526-1543` |
| Webview `addDocumentCard` | EXISTS | `media/chat.js:3706-3781` |
| Kind label “Markdown” (CSS uppercases) | EXISTS | `media/chat.js:3690-3698`, `media/chat.css:879-885` (`text-transform: uppercase` → **MARKDOWN**) |
| Message router `case "document"` | EXISTS | `media/chat.js:5467-5468` |
| Activity carousel treats document as segment break | EXISTS | `media/chat.js:3709`, `test/activity-carousel.dom.test.ts:216-230` |
| Product plan for feature | EXISTS | `docs/plans/business-documents.md` (status Implemented) |
| Unit tests extraction + kinds | EXISTS | `test/business-docs.test.ts` |
| DOM card tests | EXISTS | `test/business-docs.dom.test.ts` |
| Workspace Docs browser (E2, separate surface) | EXISTS | `src/workspace-docs.ts` — **not** the mid-turn tile; uses same `businessDocKindForPath` |

## What the user sees (causal chain)

1. Agent completes a tool (`tool_call` or `tool_call_update`) whose payload is completed (`src/acp.ts:551-555`).
2. `emitToolBusinessDocs` runs on **every** completed tool — not media-tool-scoped (`src/acp.ts:585-597`; comment at 579-583: intentional for shell skills).
3. `extractBusinessDocumentPaths` scans **tool result text blocks** for JSON `path` / `output` / `file` / `paths` **or** prose paths matching the business-ext regex (`src/acp-dispatch.ts:298-328`).
4. `.md` / `.markdown` classify as kind `"markdown"` (`src/acp-dispatch.ts:240-241`).
5. Host resolves path and **`emit`s** `{ type: "document", kind, path, name }` — buffered for replay (`src/sidebar.ts:1523`; plan A4 required `emit` not `postTo`).
6. Webview `addDocumentCard` builds `.document-card` with kind chip + name + Copy/Open/Reveal (`media/chat.js:3706-3781`).
7. Kind text is `"Markdown"`; CSS forces uppercase → UI shows **MARKDOWN** (`media/chat.css:879-885`).
8. Card is appended under `answerParent()` with explicit comment: *“Deliverable — part of the final answer surface, not ephemeral activity”* (`media/chat.js:3778-3779`).
9. `finalizeActivity()` runs so the card **breaks** the live activity carousel and **stays** after the turn seals (`media/chat.js:3709`; `test/activity-carousel.dom.test.ts:228-230`).

**Why they “stay”:** by design. Document cards are permanent transcript deliverables (like `/imagine` media), not tool-row chrome and not activity-carousel steps. They also reappear on tab restore because the host buffers them via `emit`.

**Why they appear so often in coding sessions:** any completed tool whose result text includes a path ending in `.md` (JSON path field or absolute/relative prose with a path prefix) yields a card. Agents constantly touch plan files, READMEs, skills, ADRs. Absolute paths always pass through resolve even if missing on disk (`src/sidebar.ts:1530-1534` — exists check falls through to still surface absolute paths).

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- `businessDocKindForPath` / `extractBusinessDocumentPaths` — single choke point for “should this path card?” (`src/acp-dispatch.ts:257-328`)
- `emitToolBusinessDocs` — single host emit choke point (`src/acp.ts:585-597`)
- Media pipeline parallel: `isMediaGenToolCall` + extract only for known gen tools (`src/acp.ts:568-577`) — **contrast:** business docs deliberately do **not** use a tool-name allowlist
- `openStrategyForKind` — markdown/csv/text → editor open (`src/acp-dispatch.ts:279-282`)
- Changed-files strip — already surfaces applied **edits** without document cards (`CLAUDE.md` chat surfaces; not re-read this session in full)

## Supersession
What this change replaces, duplicates, or makes dead.

**Human gate update:** disable **all** tool-result document auto-cards (every former kind), not only markdown/text.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Live `extractBusinessDocumentPaths` → card refs (all kinds) | `src/acp-dispatch.ts:298-328` | `emitToolBusinessDocs` only (`src/acp.ts:593`) | Product: no mid-turn document tiles |
| `emitToolBusinessDocs` emissions | `src/acp.ts:585-597` | tool_call / tool_call_update handlers | Same |
| Extract positives in unit tests (docx, xlsx, md, …) | `test/business-docs.test.ts` | 1 file | Invert to always `[]` |
| CLAUDE.md claim of live business document cards from tools | `CLAUDE.md` chat surfaces | docs only | State disabled |
| Original plan A2–A5 live card acceptance | `docs/plans/business-documents.md` | historical | LEAVE history; live behavior replaced |

Caller count for `businessDocKindForPath`: `acp-dispatch` extract, `sidebar` post/open, `workspace-docs.ts` — **LEAVE** the classifier; only card emission dies.

## Prior attempts
- `docs/plans/business-documents.md` — shipped feature; risk table already predicted *“False-positive cards (agent mentions an existing file)”* and mitigated with “tool content only, not agent prose” — **insufficient** for coding workflows that legitimately touch many `.md` paths in tools.
- Business Studio welcome starters for doc types — **removed** from UI (catalogs remain for tests); reinforces thin-client direction.

## Conventions
How this repo actually works, with an example of each.

- **Pure policy in `acp-dispatch.ts`, impure glue in `acp.ts`/`sidebar.ts`, render in `media/chat.js`** — `src/acp-dispatch.ts:298` comment + `src/acp.ts:585`
- **Tests:** vitest unit (`test/business-docs.test.ts`) + happy-dom (`test/business-docs.dom.test.ts`); suite command `npm test`
- **Replay-safe content:** host `emit` not `postTo` for document cards (`src/sidebar.ts:1511-1513`)
- **Layout:** no `@media` in `chat.css`; document card uses VS Code CSS variables (`media/chat.css:866-919`)

## Absences
- No product setting `grok.showDocumentCards` today.
- No tool-kind filter on business docs (reads and writes both eligible if path appears in content).
- No “dismiss card” or auto-collapse.
- Coverage tool: NONE per AGENTS.md.

## Danger zones
- `businessDocKindForPath` shared with `workspace-docs.ts` — changing the map affects Docs browser classification, not only chat cards.
- Absolute path always-surface (`sidebar.ts:1530-1534`) can create cards for paths that don’t exist.
- Activity-carousel segment-break tests assume document cards remain permanent — update carefully if cards become rarer (tests can still dispatch synthetic `document` for Word).
