# Design — Grokbit Actions stay visible across Agent switch

## Options considered

### Option A — Webview: re-request on `backendChanged`; keep last payload until new one arrives
Approach:
1. On `backendChanged`, **do not** set `state.capabilities = null` and **do not** call `hideCapabilitiesPanel()` while welcome is still up.
2. Update backend label/placeholder/settings as today.
3. If `state.showCapabilities`, immediately `vscode.postMessage({ type: "listCapabilities" })` so the host re-scans for the new backend.
4. When `capabilities` arrives, existing handler re-renders (workflow tiles typically unchanged; `actionsScope: "all"` gets correct roots).
5. Rewrite the DOM regression test that currently requires permanent hide.

Trade-off: Brief display of previous backend’s **non-suite** groups is possible only when `actionsScope === "all"` until the new scan returns. Default workflow suite is agent-identical, so no wrong tiles. Minimal host change. Matches “stay visible” exactly.

### Option B — Host-only: call `listCapabilities` after `switchBackend`
Approach: After posting `backendChanged` and starting the session (or once client is live), host always `listCapabilities(session)`. Leave webview clear+hide as-is.

Trade-off: Restores Actions when the reply lands (fixes permanent disappear) but **keeps the flash-to-empty** (clear still runs). Does not match “should stay visible.” Also competes with `commandsUpdate` re-scan and does not fix a webview that never re-requests if host path is skipped on failed start.

### Option C — Split by scope: keep suite groups, clear others
Approach: On `backendChanged`, filter retained groups to `grokbit` only (or re-render suite from retained payload), hide non-suite kinds, then re-request full scan.

Trade-off: Most precise for `actionsScope: "all"`, more branching and test surface for a bug users hit on default workflow UI. Higher complexity than A for little default-path gain.

## Decision
**Chosen: A** (webview keep + re-request), with a small optional host belt-and-suspenders from Option B only if Survey race analysis during implement shows `commandsUpdate`/start failures leave the panel stale — **not required for v1 of this plan.**

Rationale against constraints:
- Directly implements “Actions stay visible.”
- Aligns with product fact that default Actions are the shared suite.
- Touches the known bad branch + one regression test; low blast radius.
- Re-request on flip keeps `actionsScope: "all"` correct after a short retention window.

What the rejected options were better at:
- **B** is simpler host-side if someone already owns sidebar restarts — but does not stop the empty flash.
- **C** is better if marketing later shows full skill browsers per agent on the welcome canvas as first-class — not current default.

## Shape of the change

### Webview (`media/chat.js` ~`backendChanged`)
Today (`media/chat.js:5558-5578`):

```text
state.backend = …
state.capabilities = null
hideCapabilitiesPanel()
// … labels / settings …
```

Target (required contract):

```text
const prevBackend = state.backend
state.backend = msg.backend || "grok"
// REQUIRED: do NOT null state.capabilities; do NOT hideCapabilitiesPanel for this message alone
// … labels / settings … (unchanged: updateBackendLabel, placeholder, gear, refreshSessionSettingsMounts)
if (state.showCapabilities && state.backend !== prevBackend) {
  vscode.postMessage({ type: "listCapabilities" })
}
renderCapabilitiesPanel()  // re-draw from retained payload if welcome still up; no-op if null/hidden
if (capabilitiesPopover open) renderCapabilitiesPopoverBody()
```

**Hard rules for implement:**
1. Never clear or hide the Actions panel **solely** because `backendChanged` arrived.
2. Re-request only when the backend id **actually changes** (avoids double-scan with `initialState` on every `replayInto` same-backend `backendChanged`).
3. After label updates, always re-render panel/popover from retained state so lock styling follows `state.busy` without wiping tiles.

### Host
No required change for Option A: `listCapabilities` already handles the webview’s request (`src/sidebar.ts:3072-3073`, `3240-3319`).

### Tests (`test/capabilities.dom.test.ts`)
Replace `[R] backendChanged clears a retained capabilities payload…` with:

- Given welcome panel showing capabilities, dispatch `backendChanged` to the **other** backend.
- Expect panel **still visible** with retained content (not `hidden` / not empty HTML solely from the flip).
- Expect `listCapabilities` posted **once** after a true flip.
- Dispatch `backendChanged` with the **same** backend again → expect **no additional** `listCapabilities` (same-backend / replay path).
- After a fresh `capabilities` payload, panel still visible.
- Drop the old “setBusy must not resurrect after clear” assertion for this path — retention is intentional.

Also keep existing: first-send still hides Actions; `showCapabilities:false` still never renders.

### `replayInto` / ready interaction
`replayInto` posts `backendChanged` with the session’s current backend (`src/sidebar.ts:4454`). With the **same-backend gate**, that message does **not** re-request; `initialState` remains the reveal scan (`media/chat.js:5377-5378`). Agent flip always changes backend id → one re-request.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Clear+hide on `backendChanged` | REPLACE | Causes permanent empty Actions on same-panel Agent switch; obsolete for default suite-identical Actions | Remove null/hide; add re-request + re-render |
| DOM test expecting permanent hide | REPLACE | Encodes old policy | Rewrite to assert stay-visible + listCapabilities |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| `showCapabilities: false` | No re-request; panel stays hidden (existing gate) |
| Welcome already cleared (user sent a message) | Panel stays hidden via `welcomeVisible` gate; re-request may still run (harmless) or can be gated on `welcomeVisible` to save work |
| Host scan fails | Existing `capabilities` error empty state (`media/chat.js:1001-1007`) |
| `actionsScope: "all"` | Previous backend’s non-suite rows may show briefly; replaced when scan returns |
| Failed `startSession` after flip | Webview already shows new backend chip; Actions stay from retained + re-scan (scan does not need live client for disk suite) |
| Mid-restart `setBusy` | Retained payload re-renders locked/unlocked (existing `setBusy` path) |

## Migration
Schema change: no  
Reversible: yes (revert webview branch + test)  
Existing rows: n/a  
Mixed-version window: n/a  

## New dependencies
None.
