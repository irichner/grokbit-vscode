# Intent — Disable tool-result document cards

## Problem

During agent turns the chat paints permanent **document result cards** (kind chip + filename + Copy/Open/Reveal) whenever a completed tool result mentions a path with a “business” extension (`.md`, `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`, `.txt`, …). The kind label is CSS-uppercased (**MARKDOWN**, **WORD**, …). Cards never join the activity carousel and never dismiss when the turn ends, so ordinary coding and doc work floods the transcript with deliverable-style tiles.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] A human can state why those tiles used to appear (tool-result path → document card) and why they stayed (buffered deliverable).
- [ ] After the fix: **no** new document card appears for **any** former card kind when a tool result mentions Word / Excel / PowerPoint / PDF / CSV / Markdown / Text paths (e.g. `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`, `.md`, `.txt`).
- [ ] After the fix: generated-media cards (`/imagine`), tool rows, and the changed-files strip still work as before.
- [ ] After the fix: Docs browser / workspace doc classification still works where it relies on `businessDocKindForPath` (kinds remain classifiable; only **auto-cards from tool results** stop).
- [ ] Unit tests no longer expect tool-result extraction to produce card refs; suite green (`npm test`).
- [ ] CLAUDE.md chat-surfaces text no longer claims live tool results surface business document cards (or states they are disabled).

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Not removing the webview `.document-card` renderer yet (old buffered/replayed sessions may still paint historical cards) — optional dead-code cleanup later.
- Not removing Docs popover / workspace-docs scan.
- Not changing generated-media, tool rows, changed-files strip, or permission cards.
- Not a new setting toggle (feature off by product policy, not user config).
- Not Marketplace release / version bump (user-initiated rebuild).
- Not re-enabling Business Studio welcome starters.

## Constraints
- Stack: pure helpers in `src/acp-dispatch.ts`, emit in `src/acp.ts`, host post in `src/sidebar.ts`, render in `media/chat.js`.
- Must not break: media pipeline; Docs browser classification; pure/test split.
- Thin coding client direction: permanent “deliverable tiles” from every touched path are out of product fit.

## Assumptions
Decided rather than asked.

- User wants **all** tool-result document auto-cards off — not only MARKDOWN/TEXT. **Confirmed** in follow-up: also stop Word / Excel / PowerPoint / PDF / CSV.
- Preferred fix is **disable emission**, not a setting.
- Leaving historical replay of old `document` buffer messages is acceptable (no migration of on-disk history).

## Questions asked
Max 3, one batch. Record the answers.

1. Q: Should Word/Excel/PowerPoint/PDF/CSV document cards stay? → A: **No** — stop carding those as well (user 2026-08-01 follow-up).
