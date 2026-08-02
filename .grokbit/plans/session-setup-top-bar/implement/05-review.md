# Scope audit log — session-setup-top-bar

Append-only, one section per task.

## T1 — Dual-anchor session-settings popover placement
Reviewed: working tree (commit deferred)

- `IN_SCOPE` `media/chat.js` — `positionSessionSettingsFromTop` + re-parent branch in `openSessionSettingsPopover`
- Clean. No out-of-scope hunks.

### Outcome — T1
Rounds used: 1 of 2
Unresolved at cap: none

## T2 — Pure chip label helper
Reviewed: working tree (commit deferred)

- `IN_SCOPE` `media/webview-helpers.js` — `sessionSetupChipLabel` + export
- `IN_SCOPE` `test/webview-helpers.test.ts` — unit cases
- Clean.

### Outcome — T2
Rounds used: 1 of 2
Unresolved: none

## T3 — Top-bar chip shell, CSS, paint, wire, truth table
Reviewed: working tree (commit deferred)

- `IN_SCOPE` `src/sidebar.ts` — `#session-setup-chip` in getHtml top-bar
- `IN_SCOPE` `test/webview-harness.ts` — BODY parity
- `IN_SCOPE` `media/chat.css` — chip styles, `#history-btn { margin-left: auto }`, three-surfaces comment
- `IN_SCOPE` `media/chat.js` — chip paint, wire, refresh, onboarding hide, aria, dual-anchor (from T1)
- Clean. No host protocol changes.

### Outcome — T3
Rounds used: 1 of 2
Unresolved: none

## T4 — DOM tests for top-bar chip
Reviewed: working tree (commit deferred)

- `IN_SCOPE` `test/session-setup-chip.dom.test.ts` (new) — cases 1–10 covering design list
- Clean.

### Outcome — T4
Rounds used: 1 of 2
Unresolved: none

## T5 — Release-facing docs one-liner
Reviewed: working tree (commit deferred)

- `IN_SCOPE` `README.md` — feature table + Session setup section
- `IN_SCOPE` `CLAUDE.md` — session setup bullet mentions top-bar chip + dual-anchor
- Clean.

### Outcome — T5
Rounds used: 1 of 2
Unresolved: none
