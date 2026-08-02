# Design — Session tabs survive VS Code reload / restart

## Options considered

### Option A — Harden identity: keep resume id + pure restore policy + re-stash state on ready
Approach:
1. Extract a pure `panel-restore` policy module that, given serializer `{id?, backend?}`, `alreadyOpen`, and `panelVisible`, returns `reveal-existing` | `resume{id,backend,spawn:now|pending}` | `dispose-orphan`.
2. Fix `startSession` so a provided `resumeId` **keeps** `session.activeSessionId = resumeId` for the whole spawn/load window (only clear for true new sessions).
3. On every panel `ready`, if `session.activeSessionId` is set, post identity so the webview `setState({id, backend})` runs even before the next ACP `session` event (covers restored tabs that have id on the host but have not finished `session/load` yet).
4. Replace silent “missing id → new session” with **dispose-orphan** (log to Output). User reopens from launcher.
5. Keep serializer path **non-blocking**: never await full ACP `startSession` inside `deserializeWebviewPanel` / `restorePanel`. Visible resume still `void startSession`; hidden still `pendingStart`. Duplicate prevention relies on stable `activeSessionId`, not on awaiting load under `beginOpen`.

Trade-off: Small pure module + modest sidebar/webview glue; no new deps. Does not re-create tabs when VS Code drops them. Dispose-orphan removes chrome when state is missing (honest) instead of empty fake sessions.

### Option B — Minimal surgical fix only (`activeSessionId` keep on resume)
Approach: Only stop clearing `activeSessionId` when `resumeId` is set.

Trade-off: Smallest diff. Leaves missing-id → new empty session behavior intact (survey primary empty-reload path). No pure decision tests for restore matrix.

### Option C — Flip `retainContextWhenHidden: true`
Trade-off: Rejected by architecture and intent non-goals; does not survive extension host death.

## Decision
**Chosen: A** (revised after review — no host workspaceState registry in v1; no await of ACP start in serializer)

Rationale: Done-criteria need correct resume when state exists, no duplicate tabs while connecting, correct backend, and no silent empty “restored” sessions. Stable id + dispose-orphan + re-stash address those without blocking window restore.

What rejected options were better at: B is smaller if only the id-wipe race is live; C reduces in-window tear-down cost only.

## Shape of the change

### Pure policy — `src/panel-restore.ts` (new)
```
decidePanelRestore({
  id?: string;
  backend?: BackendId;
  alreadyOpen: boolean;
  panelVisible: boolean;
}): 
  | { action: "reveal-existing" }
  | { action: "resume"; id: string; backend: BackendId; spawn: "now" | "pending" }
  | { action: "dispose-orphan"; reason: "missing-id" }
```
Rules:
- `alreadyOpen` → `reveal-existing` (caller disposes the duplicate panel / reveals winner).
- no `id` (empty/undefined/whitespace) → `dispose-orphan`.
- else → `resume` with `backend: backend ?? "grok"`, `spawn: panelVisible ? "now" : "pending"`.

No host registry input in v1.

### `restorePanel` wiring
- Call `decidePanelRestore` first.
- `reveal-existing` / `dispose-orphan`: dispose incoming panel (and reveal existing when applicable); log orphan.
- `resume`: set `session.activeSessionId` + `backend`, `bindPanel`, title from disk, then `void startSession` or `pendingStart` per `spawn`. Do **not** await ACP start. `beginOpen`/`endOpen` may wrap only the synchronous bind (existing), because id stays stable for the whole start.

### `startSession` identity — REPLACE wipe on resume
At `src/sidebar.ts:2125` today: always `session.activeSessionId = undefined`.
Change:
- if `resumeId` → `session.activeSessionId = resumeId` (keep/set).
- else → `session.activeSessionId = undefined` (new session until `session/new`).

Do not change buffer clear / scroll reset behavior.

### Webview re-stash
- Host posts on `ready` (via `postPanelConfig` or adjacent): e.g. `{ type: "sessionIdentity", sessionId, backend }` when id known (from `session.activeSessionId` / `pendingStart`).
- `chat.js` handles it with the same `vscode.setState({ id, backend })` as the `session` case.
- Keeps existing `session` handler path.

### Unhappy paths
| Scenario | Behavior |
|---|---|
| Serializer state has id | Resume `session/load`; history streams via emit; id stable entire time |
| Serializer state missing | Dispose panel; Output log; reopen from launcher |
| Disk session gone | Existing startSession error/onboarding emit |
| Duplicate open while connecting | `openTabForId` finds `activeSessionId` → reveal |
| Background restore | `pendingStart`; first ready starts resume |
| Serializer slowness | restorePanel returns after bind; CLI starts async |

### Migration / deps
None. No workspaceState key in v1.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Inline missing-id → new session in `restorePanel` | REPLACE | Empty fake restored tabs | Pure `dispose-orphan`; remove new-session fallback |
| Unconditional `activeSessionId = undefined` at startSession | REPLACE | Identity hole during resume | Keep id when `resumeId` set |
| Webview-only identity | LEAVE (primary) + small re-stash assist | VS Code maps panel↔state; host cannot invent mapping for empty state | Re-stash on ready when id known; no second serializer |
| Short `beginOpen` on restore | LEAVE | Await load in deserialize is unsafe (review BLOCKER); stable id makes long guard unnecessary | Document why leave is correct after identity fix |

## Unhappy paths
(see table)

## Migration
N/A

## New dependencies
None.
