# Survey — Session tabs survive VS Code reload / restart

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Panel view type + serializer registration | EXISTS | `src/extension.ts:94–97`, `src/sidebar.ts:233` (`panelViewType = "grok.session"`) |
| Activation for restored panels | EXISTS | `package.json:47–48` (`onWebviewPanel:grok.session`) |
| `restorePanel` host entry | EXISTS | `src/sidebar.ts:791–826` |
| Webview serializer state `{id, backend}` | EXISTS | `media/chat.js:5544–5547` (`vscode.setState` on `session` event only) |
| `setState` test coverage | EXISTS | `test/backend-chip.dom.test.ts:200–251` |
| `pendingStart` lazy spawn | EXISTS | `src/session.ts:284–291`, consumed `src/sidebar.ts:2760–2765` |
| `startSession` resume via `session/load` | EXISTS | `src/sidebar.ts:2505–2568`, `src/acp.ts:281–303` |
| `PanelRouter` buffer + `replayInto` | EXISTS | `src/panel-router.ts:74–107` |
| `ready` → config + replay + pendingStart | EXISTS | `src/sidebar.ts:2751–2767` |
| `bindPanel` / `retainContextWhenHidden:false` | EXISTS | `src/sidebar.ts:719–775` |
| Host open-tab registry in workspaceState/globalState | DOES NOT EXIST | searched: `workspaceState`, open-panel persistence beyond webview `setState`; only `SESSION_META_KEY` / session rename meta in globalState |
| Pure restore-policy module (decide resume vs new, missing state) | DOES NOT EXIST | no `panel-restore.ts` / similar; logic inline in `restorePanel` |
| In-window scroll restore (related, not this bug) | EXISTS | `src/session-scroll.ts`, plan `.grokbit/plans/tab-scroll-restore/` (non-goal: full window reload) |
| CLI-update respawn of panels | EXISTS | `src/sidebar.ts:1969–1977` (uses `activeSessionId` + `pendingStart`) |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- `PanelRouter.beginOpen` / `endOpen` — `src/panel-router.ts:113–120` — shared open-in-flight dedupe for launcher / dropdown / restore.
- `restorePanel` — `src/sidebar.ts:791–826` — binds restored panel, seeds backend, visible→`startSession` vs hidden→`pendingStart`.
- `openTabForId` — `src/sidebar.ts:695–716` — finds existing panel by `activeSessionId` then reveal; else cold open + `startSession(id)`.
- `session` emit with authoritative `backend` — `src/sidebar.ts:2270–2284` — webview must stash from event field, not stale state.
- `backendBadgeLabel` / backend chip persistence tests — `test/backend-chip.dom.test.ts:200+` — pattern for serializer state assertions.
- `session-scroll.ts` pure-module pattern — `src/session-scroll.ts:1–59` — framework-free helpers + unit tests; model for a new restore-policy pure module.
- `buildPanelReplayEnvelope` / `replayInto` wrap — `src/sidebar.ts:4446–4458` — ready-driven rebuild bookends (scroll); cold restore history still comes from `session/load` into `buffer` via `emit`.
- `GrokSessionStore` / `ClaudeSessionStore` — `src/session-store.ts` — disk identity for titles/token usage after resume.
- Fake-CLI ACP integration suite — `test/acp-integration.test.ts` + `test/fixtures/fake-grok-acp.cjs` — can exercise `session/load` without real grok (not full VS Code serializer).

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts from this session’s searches.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Inline “missing id → still bind + `startSession(undefined)`” behavior | `src/sidebar.ts:808–822` | 1 (`restorePanel`) | Treats lost serializer state as a **new** session; produces empty “reloaded” tabs. Likely needs REPLACE with explicit recover/dispose policy. |
| Unconditional `session.activeSessionId = undefined` at start of every `startSession` | `src/sidebar.ts:2125` | 1 write site; many readers (`openTabForId` 697, `restorePanel` 801, dispose/live checks 868+, launcher live matching 3466+) | Wipes resume identity for the whole spawn/`session/load` window so “is this tab already open?” returns false. |
| Webview-only identity for reload (`setState` only) | `media/chat.js:5547` | 1 write path for chat panels | Single failure point; no host fallback if state is undefined on deserialize. |
| `beginOpen` only around `restorePanel` bind (not full `startSession`) | `src/sidebar.ts:792–824` | 1 | Guard ends in `finally` before async resume finishes; weaker than `openTabForId` which awaits `startSession` inside the guard (`src/sidebar.ts:703–714`). |

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- **Native tabs + serializer** (shipped): `registerWebviewPanelSerializer` + `restorePanel` + webview `setState` — this is the live path (`src/extension.ts:94–97`, CLAUDE.md § Native tabs).
- **Claude backend WP5** extended state to `{id, backend}` and host `restorePanel(..., backend)` — live; tests in `test/backend-chip.dom.test.ts:200–251`.
- **tab-scroll-restore** (implemented, commits deferred): in-memory scroll across hide→reveal; **explicitly non-goal** for full VS Code reload (`.grokbit/plans/tab-scroll-restore/01-intent.md:22`). Does not fix conversation reload.
- **Idle/LRU reaper** retired — open tabs are user-owned; not a reload mechanism (`CLAUDE.md` process bounding notes).

## Conventions
How this repo actually works, with an example of each.

- **Errors:** session start failures `emit` `{type:"error", text}` or onboarding states; catch in `startSession` — `src/sidebar.ts:2680–2744`.
- **Tests:** vitest, pure modules under `src/*.ts` without vscode; DOM via happy-dom + `test/webview-harness.ts`; no real grok in `npm test` — `CLAUDE.md` § Build + test.
- **State:** per-session bag `Session` (`src/session.ts`); buffered chat in `session.buffer`; derived UI via `postTo` / replay derived list.
- **Layout:** host orchestration in large `sidebar.ts`; policy extracted to pure files (`panel-router.ts`, `session-scroll.ts`, `plan-restore.ts`) when testability matters.
- **OS / shell for verify:** Windows workspace; `npm test` from repo root (PowerShell/cmd).

## Absences
Missing infrastructure the plan may need to add.

- No pure unit tests that encode `restorePanel` decision table (visible vs hidden, missing id, duplicate id, backend default).
- No host-side persistence of “which session ids had open panels” for this workspace.
- No `@vscode/test-electron` integration suite yet (`CLAUDE.md` What’s next #1) — full Reload Window cannot be automated in CI today; manual checklist required for end-to-end.
- Coverage tool: NONE (project test commands).

## Danger zones
- `src/sidebar.ts` — large impure host; hard to unit-test without extracting policy. Touch carefully; prefer pure helpers + source-order/parity tests.
- `retainContextWhenHidden:false` — `src/sidebar.ts:730`, `src/panel-router.ts:20–24` — flipping breaks ready/replay; out of scope.
- `session.buffer = []` + `activeSessionId = undefined` at `startSession` entry — `src/sidebar.ts:2091–2125` — high blast radius for any resume/open identity.
- Serializer `deserializeWebviewPanel` must stay registered on activation before panels restore (`src/extension.ts:94–97` + `package.json:47–48`).
- Dual-backend resume: wrong backend on restore opens wrong store/agent (`docs/plans/claude-code-backend.md` WP5 notes).

## Grounding notes (Loop 2)
Pass 1 resolved all primary entities. Pass 2 checked CLI-update respawn and scroll module as adjacent restore paths. Pass 3 not required — no unresolved entities remaining for the intent.

### Observed failure-mode facts (not recommendations)
1. **Missing serializer state starts a new session:** `restorePanel` with `id` undefined still binds and calls `startSession(session, undefined)` when visible (`src/sidebar.ts:808–819`), or sets `pendingStart = ""` when hidden (`821`), which becomes `resumeId = undefined` on ready (`2763`: `pendingStart || undefined`).
2. **Resume id is cleared for seconds during start:** `startSession` always sets `activeSessionId = undefined` (`2125`) before spawn; only after successful `loadSession` is it set back to `resumeId` (`2578`).
3. **Open guard on restore is short-lived:** `restorePanel` ends `beginOpen` in `finally` without awaiting `startSession` (`818–824`), unlike `openTabForId` (`711–714`).
4. **setState only after `session` message:** if a tab never received `{type:"session", sessionId}` before reload, VS Code has nothing useful to deserialize (`media/chat.js:5547`).
5. **History after cold restore is not in buffer until `session/load`:** after window reload, `Session` is new and `buffer` is empty; content only arrives when ACP replay emits into `emit` (`2505–2568` + `panel-router.ts:76–79`).
