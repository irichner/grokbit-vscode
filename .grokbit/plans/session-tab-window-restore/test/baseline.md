# Baseline — session-tab-window-restore

Captured BEFORE implementation on 2026-08-02 (working tree on `main`, no feature commit yet).

Records what the system does TODAY. Not what it should do.

## Captured behaviors

### B1 — Resume clears `activeSessionId` during start (task T2)
Path exercised: source read `src/sidebar.ts`
Input: `startSession(session, resumeId)` with any truthy `resumeId`
Observed output: early in the method, `session.activeSessionId = undefined` runs unconditionally; only after successful `loadSession` is it set back to `resumeId` (~line 2578).
Characterization: documented here; pure helper tests will lock the *new* contract; source-text test will lock the call site after T2.

### B2 — Missing serializer id starts a new session (task T3)
Path exercised: source read `src/sidebar.ts` `restorePanel`
Input: `restorePanel(panel, undefined, …)` or empty id
Observed output: still creates `Session`, `bindPanel`, and either `void this.startSession(session, id)` with undefined id (visible) or `session.pendingStart = id ?? ""` (hidden) — empty string becomes undefined resume on ready → **new** ACP session.
Characterization: documented; T3 removes this path.

### B3 — `setState` only on ACP `session` event (task T4)
Path exercised: `media/chat.js` case `"session"`; tests in `test/backend-chip.dom.test.ts`
Input: `{ type: "session", sessionId, backend, … }`
Observed output: `vscode.setState({ id: sessionId, backend: state.backend })`. No other host message re-stashes identity on ready.
Characterization: existing DOM tests; T4 adds a new message path.

### B4 — Suite green before change (task T5)
Path: smoke `npm test -- test/panel-router.test.ts` → 11 passed. Full suite deferred to T5 verify (baseline: assumed green on main per project floor).

## Visual captures
None (no headless Electron for Reload Window).

## NOT CAPTURED
- Live Developer: Reload Window history restore — requires VS Code + logged-in CLI.
- Concurrent open while connecting — manual only.
