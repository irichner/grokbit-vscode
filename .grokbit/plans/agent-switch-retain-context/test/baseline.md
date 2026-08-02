# Baseline — agent-switch-retain-context

Captured before / at start of implement from code (preflight).

## T2 — switchBackend with history (pre-change)
- Modal: `History can't carry over between backends — this tab will start a fresh … session.` (`src/sidebar.ts` former lines ~621–628)
- On confirm: flip `session.backend`, `startSession` with no resumeId → `session.buffer = []`, `hasHistory = false`
- No handoff inject; old disk session discarded only when `!hasHistory`

## T3 — sessionContext banner
- Fixed copy: `Context from previous session applied` (`media/chat.js` `addSessionContextBanner`)

## T4 — docs
- Non-goal: not carrying conversation history across a backend flip (`docs/plans/claude-code-backend.md`)
