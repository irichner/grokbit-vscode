# Design — Phase A: Trust & host stability

## Options

### Option 1 — Path-scoped grant queue (recommended)

On each **allow** (user or autoApprove), extract `{ path? | command? }` from `toolCall.rawInput` / title heuristics into a pure `permission-bind` module; push onto `Session.approvedGrants`.

On `fs/write_text_file` / `terminal/create` (after plan-gate, before actual IO):

- If there are **no** path- or command-scoped grants pending, behavior unchanged (Agent may write without a prior permission).
- If there **are** path-scoped grants: write path must match a grant (normalize + case rules consistent with existing path helpers); **consume** one matching grant on success.
- Mismatch or only non-matching grants: `respondError` + emit `mutationBlocked` (or new `permissionBindBlocked`) so UI shows a notice.
- `allow_always` for a path: keep a durable session grant (not single-consume) until mode change / session end.
- Terminal: same for command string equality (normalized whitespace) when grant has `command`.

**Pros:** Matches the stated threat (preview A, write B); pure + unit-testable; works without toolCallId on fs methods; YOLO covered if autoApprove records grants.  
**Cons:** Same-path content swap still possible (accepted non-goal); grants with no extractable path remain unscoped (consume-one-any or skip binding — prefer **skip binding** and log once to avoid false sense of security).

### Option 2 — Hard “every write needs a grant”

Every `fs/write` requires a matching prior allow.  
**Pros:** Stronger.  
**Cons:** Breaks Agent mode when CLI writes without `request_permission`; large product break; rejected.

### Option 3 — Content hash binding

Hash preview content; require write body match.  
**Pros:** Stops same-path bait-and-switch.  
**Cons:** Breaks legitimate post-approval edits; Claude edit is old/new string not full file; deferred.

### Option 4 — Claude full `clientPlanGate: true`

Flip quirk true for Claude.  
**Pros:** One line.  
**Cons:** Sidebar pre-reject may block legitimate Claude plan permissions (survey comments). Prefer **split**.

## Decision

**Primary: Option 1** for permission binding.  
**Claude plan: split gate** — introduce `clientPlanGate` semantics:

- Keep flag name for fs/terminal **or** add `clientPlanFsGate` / use existing with refined meaning:
  - **Recommended:** Set Claude `clientPlanGate: true` for **fs/terminal only**, and gate **permission pre-reject** on a new quirk `clientPlanPermissionReject: true` for Grok only (`false` for Claude).  
  - Migration: Grok both true; Claude fs gate true, permission reject false.

**CLI update:** `disposePool("grok")` only; only grok panels get `cliUpdating` restart / `pendingStart`; Claude panels untouched. Busy warning counts **grok** busy sessions only (or all busy if we still want honesty that Claude is fine — prefer grok-only count + copy “Grok sessions”).

**Synthetic label:** When `permissionDiffFromRawInput` supplies the diff (no `pendingDiffByToolCallId` hit), append subtitle/badge “Preview from agent input”.

**Install:** Verify async already; update CLAUDE.md; optional `cancellable: true` on `withProgress` that abandons awaiting promise (npm may continue in background — document best-effort cancel).

## Architecture sketch

```
permission allow ──extractGrant(rawInput)──▶ Session.approvedGrants[]
                                                    │
fs/write_text_file ──planGate?──▶ matchWriteGrant(path, grants)
                         │ match → consume → fsWrite
                         │ fail  → respondError + mutationBlocked
terminal/create   ──same with command──▶
```

New pure module: `src/permission-bind.ts` (or extend `plan-gate.ts` if kept small — prefer **new file** so plan-mode policy stays separate from approval binding).

## Disposition table

| Item | Disposition | Reason |
|------|-------------|--------|
| Unbound writes after allow | REPLACE | Grant match on write/terminal |
| Monolithic Claude off plan gate | REPLACE | Split quirks; Claude gets fs/terminal only |
| CLAUDE.md sync install limit | REPLACE | Reflect async install |
| `disposePool()` on grok update | REPLACE | Backend-scoped dispose + panel filter |
| `pendingPermissions` persist shape | LEAVE | Resume UI unchanged |
| Content-hash binding | LEAVE | Non-goal v1 |
| Every-write-requires-grant | LEAVE | Would break Agent mode |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| False block: path normalization (Windows `/` vs `\`, realpath) | Reuse/normalize with same rules as `isInsideWorkspace` / `path.normalize`; tests for both seps |
| rawInput shapes differ grok vs Claude | Extractor handles `file_path`, `path`, nested; unit fixtures from research notes |
| allow_always floods durable grants | Cap N paths per session; document |
| Claude plan fs gate blocks plan.md outside workspace | Existing `shouldBlockWrite` already allows grok plan file under grokHome; Claude plan files location `UNVERIFIED` — if Claude writes plan inside workspace, may need allowlist — record in assumptions |
| Cancel install leaves partial npm tree | Existing re-install overwrites prefix; document |

## UI

- Bind failure: reuse `planBlocked` / `mutationBlocked` messaging with distinct text: “Blocked: write path did not match the approved file.”
- Synthetic preview: muted `.card-subtitle` or badge; VS Code theme tokens only.
