# Business quick-actions (E1)

| Field | Value |
|-------|--------|
| **Status** | Implemented (with Studio 3.0.0 bar) |
| **Roadmap** | [grokbit-business-studio-3.0.md](grokbit-business-studio-3.0.md) E1 |
| **Product** | [Grokbit-ui-3.0.0](Grokbit-ui-3.0.0) |

## Goal

On **welcome / empty session only**, offer **task-oriented** chips (invoice, receipt, weekly report, pitch, approval) that seed the composer. Never auto-send. No launcher task row. Do not re-list format icons.

## Acceptance criteria

| # | Criterion | Verify |
|---|-----------|--------|
| A1 | `taskQuickActions()` ≥5 frozen ids + seeds | unit |
| A2 | Welcome only; no mid-chat chrome; no launcher tasks | DOM + launcher |
| A3 | empty→set / non-empty→append; never auto-send | pure + DOM |
| A4 | No format-icon duplicate; welcomeStarters kept | catalog + DOM |

## Non-goals

Launcher task row; auto-send; format icons in chat; replace welcome starters.

## Surfaces

`media/webview-helpers.js` (`taskQuickActions`, `applyComposerSeed`), `media/chat.js`, `media/chat.css`, tests.
