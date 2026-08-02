# Review log — Session tabs survive VS Code reload / restart

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[BLOCKER]` Design tells `restorePanel` to **await `startSession`** (full CLI spawn + `session/load`) under the open guard — evidence: `03-design.md` Open guard § (“prefer await `startSession` like `openTabForId`”). `restorePanel` is invoked from `deserializeWebviewPanel` (`src/extension.ts:95–96`). Holding the serializer promise for multi-second (or hung) ACP startup can stall or fail **window restore** itself. Current code fire-and-forgets spawn for a reason (`src/sidebar.ts:818–819`). Resolves by: never await full agent start inside deserialize; stabilize identity synchronously (`activeSessionId` + bind + `pendingStart`/`void startSession`) so duplicates are preventable without blocking VS Code.

- `[MAJOR]` Host open-tabs **fallback** is marketed in Option A then gutted by the conservative rule (registry must not map empty-state panels) — evidence: `03-design.md` lines 9–10 vs 53–56. Registry then only “re-stash / future command”, which is not required by any done-criterion and adds workspaceState write surface without fixing reload when serializer state is present. Resolves by: drop host registry from v1 **or** justify a done-criterion it alone satisfies; re-stash can use in-memory `session.activeSessionId` already set on bind.

- `[MAJOR]` Intent done-criterion “both tabs reappear with history after Reload Window” is not proven if the common failure is missing serializer state and the fix is dispose-orphan — user sees **fewer** tabs, not restored history. Evidence: dispose-orphan rule + intent line 9. Resolves by: (1) prioritize fixes when state **is** present (identity wipe / resume); (2) for missing state, document UX (dispose + launcher) in intent-aligned language; (3) ensure `setState` is written early and re-written on every ready so missing state becomes rare; (4) optional: when state missing, keep panel with an honest “Session identity lost — reopen from history” card instead of dispose — pick one and make done-criteria match.

- `[MINOR]` `hostOpenTabs` still listed as pure-policy input after conservative rule makes it unused for decisions — dead parameter smell.

- `[MINOR]` Spot-check: survey citation `src/sidebar.ts:2125` for `activeSessionId = undefined` matches the file read this session.

### Architect response — Round 1
- `[BLOCKER]` await startSession in deserialize → **REVISED**: Serializer path must remain non-blocking for ACP start. Identity is fixed synchronously; `void startSession` / `pendingStart` retained. Open-guard alignment no longer requires awaiting load.
- `[MAJOR]` host registry → **REVISED**: Dropped from v1. Re-stash on ready uses session fields only.
- `[MAJOR]` dispose-orphan vs done-criteria → **REVISED**: Primary fix is correct resume when `{id,backend}` present + keep id during start + early/repeated setState. Missing-state: keep panel with honest recovery UI (not silent new session, not silent dispose without message) — see design rev.
- `[MINOR]` dead `hostOpenTabs` input → **REVISED**: removed from policy inputs.

## Round 2
Reviewed: revised `03-design.md` (after Round 1 edits)

- `[MAJOR]` “Honest recovery UI” for missing state is underspecified (new webview message? reuse onboarding?) and risks scope creep into chat.js chrome without a verify path beyond manual. Resolves by: v1 missing-state = **dispose orphan panel** + one Output channel line (existing pattern when double-open disposes) OR a single buffered `{type:"error", text}` if panel is kept; pick dispose for minimal surface and update intent assumption that empty tabs go away rather than become empty chats. Launcher remains the reopen path (already in intent non-goals / full-quit clause).

- `[MINOR]` Ensure CLI-update respawn path (`sidebar.ts:1969–1977`) still works when `activeSessionId` is kept during start (should improve it).

### Architect response — Round 2
- `[MAJOR]` missing-state UX → **REVISED**: dispose-orphan + `output.appendLine`; no new recovery card in v1. Done-criteria already allow launcher reopen when VS Code/layout drops tabs; missing state is the same class of “panel cannot be bound to a session”.
- `[MINOR]` CLI-update → noted as regression-safe / improved by stable id; no extra task beyond startSession identity fix.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (BLOCKER/MAJOR addressed in design)

## Plan review (Loop 4)
One pass, after Decompose — checks the task list against the design, not the design decision again.  
Reviewed: `plan.md`

- `[MINOR]` T3 source-text verify is a bit brittle (string absence of `pendingStart = id ?? ""`) — acceptable for this repo’s sidebar parity pattern; implementer may refine.
- `[MINOR]` Verification matrix row “Reload Window: tabs restore with prior conversation” relies on existing `session/load` once identity is correct — true, but if the live bug is elsewhere (ACP hang), unit tests stay green while manual T5 fails; assumptions already flag that.

No `BLOCKER`. Disposition summary matches design (2 REPLACE, 2 LEAVE). Every done-criterion has a matrix row. Tasks have verify/baseline/removes/rollback.

### Architect response
- `[MINOR]` notes accepted; no plan rewrite required.

Outcome: clean
