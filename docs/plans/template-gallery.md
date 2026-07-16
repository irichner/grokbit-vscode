# Template gallery v1 (E4)

| Field | Value |
|-------|--------|
| **Status** | Implemented (with Studio 3.0.0 bar) |
| **Roadmap** | [grokbit-business-studio-3.0.md](grokbit-business-studio-3.0.md) E4 |
| **Product** | [Grokbit-ui-3.0.0](Grokbit-ui-3.0.0) |

## Goal

In-chat **Templates** popover with **14** business templates; search; Use → seed only (never auto-send). Skills still generate files.

## Acceptance criteria

| # | Criterion | Verify |
|---|-----------|--------|
| A1 | 12–15 templates; searchable title/tags; empty search state | pure + DOM |
| A2 | Use seeds via applyComposerSeed; never send | DOM |

## Non-goals

50+ templates; in-extension generation; permanent Templates tab; auto-send.

## Surfaces

`media/webview-helpers.js` (`businessTemplates`, `filterTemplates`), `media/chat.js`, `media/chat.css`, tests.
