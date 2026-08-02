# Implement handoff — duplicate-user-prompt-card

Input contract for `grokbit-test` verify mode.

## Completed
- T1 — Hide active turn header; single visible sticky prompt after send (`media/chat.css` + turn-container DOM tests)
- T2 — Full suite green (1392 tests)

## Blocked
- none

## Surface changed
Files: `media/chat.css`, `test/chat-turn-containers.dom.test.ts`
Endpoints added/changed: none
Schema changes: none
UI views affected: session chat webview (`.turn` / user prompt chrome)
Dependencies added: none

## Look here hard
- **Active send:** after `userMessage`, only one prompt card should show (full sticky `.msg.user`); no chevron header card above it.
- **Next send:** prior turn collapses to one-line header (header reappears when `.active` removed).
- **CSS-only fix:** happy-dom does not paint stylesheets — regression guard is source contract `display: none` on `.turn.active .turn-header` plus DOM structure asserts.
- **Unchanged:** seal (activity destroyed), expand prior answer, permission cards under turn.

## Deviations
See `deviations.md` — 0 counted; dirty-tree snapshot + no-auto-commit waivers only.

## Baseline reference
Captured: `test/baseline.md` (turn-container era) + plan T1 baseline description + `implement/snapshots/*.start`
