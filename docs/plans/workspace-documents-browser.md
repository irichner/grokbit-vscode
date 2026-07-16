# Workspace documents browser (E2)

| Field | Value |
|-------|--------|
| **Status** | Implemented (with Studio 3.0.0 bar) |
| **Roadmap** | [grokbit-business-studio-3.0.md](grokbit-business-studio-3.0.md) E2 |
| **Product** | [Grokbit-ui-3.0.0](Grokbit-ui-3.0.0) |

## Goal

In-chat **Documents** popover: capped list of workspace business files; Open / Reveal / Attach / Use (seed). No live Office preview.

## Acceptance criteria

| # | Criterion | Verify |
|---|-----------|--------|
| A1 | Capped list (50) of business exts; Open / Reveal | unit + DOM + host |
| A2 | Attach (chip) and/or seed path; empty state; no folder state | DOM |

## Non-goals

Live preview; unbounded scan; Explorer replacement; permanent sidebar tab.

## Surfaces

`src/workspace-docs.ts`, `src/sidebar.ts`, `media/chat.js`, `media/chat.css`, tests.
