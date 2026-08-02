# Survey — Grokbit Actions vanish on Agent switch

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Session Setup Agent pick → `switchBackend` | EXISTS | `media/chat.js:521-523` (`pickSessionSetting` rowId `"agent"`) |
| Host `switchBackend` | EXISTS | `src/sidebar.ts:614-646` |
| Webview `backendChanged` handler | EXISTS | `media/chat.js:5558-5578` |
| Capabilities clear + hide on backend change | EXISTS | `media/chat.js:5562-5567` |
| `listCapabilities` webview request | EXISTS | `media/chat.js:5377-5378` (`initialState`); Refresh / popover paths |
| Host `listCapabilities` scan + post | EXISTS | `src/sidebar.ts:3240-3319` |
| `commandsUpdate` re-scan | EXISTS | `src/sidebar.ts:2307-2313` |
| Panel `ready` → `postPanelConfig` + `replayInto` | EXISTS | `src/sidebar.ts:2751-2759`, `4400-4414`, `4447-4458` |
| Grokbit Actions visibility filter (workflow only) | EXISTS | `media/webview-helpers.js:696-718` (`CAPABILITY_VISIBLE_KINDS = ["grokbit"]`) |
| Regression test expecting clear-on-backendChanged | EXISTS | `test/capabilities.dom.test.ts:374-392` |
| Session setup Agent DOM test | EXISTS | `test/session-setup.dom.test.ts:61-66` |
| Backend chip tests | EXISTS | `test/backend-chip.dom.test.ts` |

## Reusable code
- `renderCapabilitiesPanel` / `hideCapabilitiesPanel` — `media/chat.js:961-1043` — single gate for welcome Actions mount (`showCapabilities`, welcome, onboarding, payload).
- `listCapabilities(session)` — `src/sidebar.ts:3240` — host re-scan; already used on config change and `commandsUpdate`.
- `visibleCapabilityGroups` — `media/webview-helpers.js:710-718` — default scope shows only suite (`grokbit`).
- Existing DOM harness `bootWebview` / `sendCapabilities` — `test/capabilities.dom.test.ts` — pattern for the regression rewrite.

## Control-flow (ground truth)

### User path that breaks
1. Empty tab: welcome visible; `initialState` causes webview to `postMessage({ type: "listCapabilities" })` (`media/chat.js:5371-5378`).
2. Host replies `capabilities`; `renderCapabilitiesPanel` shows tiles (`media/chat.js:5403-5419`, `978-1043`).
3. User picks other Agent on Session Setup → `vscode.postMessage({ type: "switchBackend", backend })` (`media/chat.js:521-523`).
4. Host `switchBackend`: posts `backendChanged`, then `await this.startSession(session)` **on the same panel** (`src/sidebar.ts:638-645`). Does **not** dispose the webview; **no** new `ready` event.
5. Webview `backendChanged` **nulls** `state.capabilities` and **hides** the panel (`media/chat.js:5562-5567`). Comment claims previous backend’s skills must not flash on a later `setBusy:false`.
6. No webview code on this path posts `listCapabilities`. Host only auto-rescans on `commandsUpdate` after the new client is live (`src/sidebar.ts:2307-2313`) — **not** guaranteed immediately / at all the same way as the `initialState` request.
7. User recovery: hide tab → reveal rebuilds webview → `ready` → `postPanelConfig` (`initialState`) → webview requests `listCapabilities` again (`src/sidebar.ts:2751-2758`, `media/chat.js:5366-5378`). That matches the reported “open another tab, then reselect” fix.

### Why Actions are product-identical across agents (default)
- UI allowlist is `["grokbit"]` unless `actionsScope === "all"` (`media/webview-helpers.js:696-718`).
- Host still scans `CAPABILITY_ROOTS[session.backend]` (`src/sidebar.ts:3256-3258`) and re-keys suite via `applySuiteKind` (`src/sidebar.ts:3268-3270`); suite is provisioned into both homes (project map / prior suite work). Default visible tiles are the suite, not backend-specific Skills.

### Related: `replayInto` also emits `backendChanged`
- Every reveal ends replay with derived `backendChanged` (`src/sidebar.ts:4451-4455`).
- Order on ready: `postPanelConfig` **then** `replayInto` (`src/sidebar.ts:2757-2759`). So `backendChanged` can clear payload **after** `initialState` queued a scan; recovery still works when the later `capabilities` message arrives. Mid-session Agent switch has **no** equivalent scan trigger from the webview.

## Supersession
What this change replaces, duplicates, or makes dead.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Clear-all-capabilities-on-`backendChanged` policy | `media/chat.js:5562-5567` | 1 handler; asserted by 1 DOM test | Product now treats default Actions as agent-independent; wipe-without-re-request causes permanent hide on same-panel Agent switch |
| Regression test title/expectation: “backendChanged clears retained capabilities” | `test/capabilities.dom.test.ts:374-392` | 1 | Must assert new contract: panel stays usable / re-requests; not permanent hide |

## Prior attempts
- Comment at `media/chat.js:5562-5565` documents intentional clear to prevent wrong-backend skills flash under `actionsScope`/full discovery. Live default is workflow-only suite — that rationale no longer matches default UX.
- No alternate “keep Actions across switch” path found in `media/chat.js` or `src/sidebar.ts`.

## Conventions
- **Tests:** vitest + happy-dom; capabilities DOM tests dispatch host messages and assert `posted` / panel visibility — `test/capabilities.dom.test.ts`.
- **State:** webview `state.capabilities` is transient (not buffered); host uses `postTo` for `capabilities` (`src/sidebar.ts:3300-3308`).
- **Busy/lock:** `setBusy` re-renders panel from retained payload without re-request (`media/chat.js:5922-5927`).
- **Shell/OS:** Windows-native repo; `npm test` at repo root.

## Absences
- No host call to `listCapabilities` inside `switchBackend` after flip (`src/sidebar.ts:614-646` — only `backendChanged` + `startSession`).
- No webview `listCapabilities` post inside `backendChanged` (`media/chat.js:5558-5578`).

## Danger zones
- `media/chat.js` message switch — large file; change only the `backendChanged` branch + tests unless host re-scan is chosen.
- `actionsScope: "all"` — full Skills/Commands **do** differ by backend scan roots; fix must not leave permanently wrong non-suite lists without a refresh when that setting is on.
- `replayInto`’s synthetic `backendChanged` on every reveal — any “always clear” or “always re-request” behavior runs on tab restore too; avoid request storms and avoid breaking serializer restore.
