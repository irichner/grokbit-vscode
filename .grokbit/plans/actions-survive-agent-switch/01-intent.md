# Intent — Grokbit Actions stay visible across Agent switch

## Problem
On a new session tab, the welcome canvas shows Session Setup and Grokbit Actions side by side. When the user changes **Agent** (Grok ↔ Claude) under Session Setup, Grokbit Actions flash briefly and then disappear. The only recovery is to leave the tab and come back (e.g. open another tab, then reselect this one). Grokbit Actions should remain visible after an Agent change; the workflow tiles are the same regardless of which agent is selected.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] On a brand-new empty session tab with Grokbit Actions visible, changing Agent under Session Setup leaves the Grokbit Actions panel **visible** (not permanently gone) after the switch settles.
- [ ] After that Agent switch, the same workflow tiles remain available (suite steps such as explore/plan/implement/test/document — or the current product suite set), without requiring a tab hide/reveal.
- [ ] Changing Agent still correctly updates Agent-specific UI (backend chip/label, model/thinking rows, composer placeholder) — only Actions must not vanish.
- [ ] Automated regression: a test fails if `backendChanged` permanently blanks the welcome Actions panel without a recovery path, and passes with the fixed behavior.
- [ ] `npm test` stays green (existing capabilities / session-setup / backend-chip coverage still passes or is deliberately updated).

## Non-goals
- Changing which skills/agents/commands discovery roots each backend scans.
- Making non-suite Skills/Commands identical across Grok vs Claude when `grok.actionsScope` is `all`.
- Changing Agent switch confirmations for sessions that already have history.
- Redesigning Session Setup or Grokbit Actions layout/visuals.
- Fixing unrelated welcome chrome (Docs, guide strip, setup card locking) beyond what is required for Actions to stay up.

## Constraints
- Stack: VS Code extension webview (`media/chat.js`) + host (`src/sidebar.ts`); grok-free vitest DOM tests.
- Must not break: plan-mode primer, empty-session recycle, backend flip restart, capability `showCapabilities` off gate, first-send `clearWelcome` hiding of Actions.
- Sequencing: pure webview + optional host re-scan; no new dependencies.

## Assumptions
- User’s “flash then disappear” is Session Setup Agent → `switchBackend` → host `backendChanged` (confirmed in survey).
- Product statement accepted as requirement: **default Grokbit Actions (workflow suite) do not depend on Agent selection** for what is shown.

## Questions asked
None — the bug report is specific, recovery path is stated, and desired behavior is unambiguous. No question would change the plan shape.
