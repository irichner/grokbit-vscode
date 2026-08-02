# Review log — Grokbit Actions stay visible across Agent switch

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[MAJOR]` Design marks `renderCapabilitiesPanel()` after `backendChanged` as “optional.” Without either re-render or an explicit “leave DOM alone” decision, implementers may call `hideCapabilitiesPanel` “to be safe” or re-introduce a partial clear. For the stay-visible contract, the contract must be: **never hide/clear capabilities solely because of `backendChanged`**; either leave the existing DOM until the next `capabilities` message, or re-render from retained `state.capabilities`. — evidence: `03-design.md` Shape § Target; survey `media/chat.js:5562-5567` — resolves by: make re-render-from-retained (or leave-DOM) **required** wording, not optional.
- `[MAJOR]` Double `listCapabilities` on every tab reveal (`initialState` + `replayInto`’s `backendChanged`) is accepted but not constrained. A test that asserts “exactly one `listCapabilities` after a full ready sequence” would flake if added later; also two scans on every reveal is unnecessary load for large skill trees when `actionsScope` is `all`. — evidence: survey `src/sidebar.ts:2757-2759`, `4451-4455`; `media/chat.js:5377-5378` — resolves by: prefer re-request on `backendChanged` only when welcome is still relevant **or** when this is a true flip (previous `state.backend !== msg.backend`), so synthetic same-backend `backendChanged` on replay does not always double-scan. **At minimum** document that `backendChanged` with the same backend id must not clear; re-request may be gated on `msg.backend !== previous`.
- `[MINOR]` Intent still carries `UNVERIFIED` that the user’s flash path is Session Setup → `switchBackend`; survey fully confirmed that path. Clean up intent assumption in implement notes only — not blocking.
- `[MINOR]` `actionsScope: "all"` brief stale non-suite rows are acknowledged; no automated test required for that setting if default workflow is the done-criterion — acceptable.

### Architect response — Round 1
- `[MAJOR]` optional re-render → **REVISED**: Required contract: do not null `state.capabilities` / do not `hideCapabilitiesPanel` on `backendChanged`. After updating `state.backend` (and labels), call `renderCapabilitiesPanel()` if welcome-visible (no-op if no payload) and re-render open popover body. When new `capabilities` arrives, existing handler remains source of truth.
- `[MAJOR]` double-scan → **REVISED**: Gate `listCapabilities` post on `state.showCapabilities && (msg.backend || "grok") !== previousBackend` (capture previous before assignment). Same-backend `backendChanged` from `replayInto` after restore does **not** re-request; Agent flip always does. `initialState` remains the reveal scan path.
- `[MINOR]` intake UNVERIFIED → survey confirmed; no design change.
- `[MINOR]` accepted.

## Round 2
Reviewed: revised design decisions above (inlined into plan; design file updated in same planning pass).

- No remaining BLOCKER/MAJOR against Option A with the two revisions.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none

## Plan review (Loop 4)
Reviewed: `plan.md`

- `[BLOCKER]` none — each task has runnable `verify:` on Windows (`npm test -- …` / `npm test` from repo root).
- `[MAJOR]` none — disposition REPLACE rows map to T1/T2; Verification matrix covers all done-criteria.
- `[MINOR]` T1 `verify` notes intermediate red until T2 — acceptable sequential pair; T3 is full gate.
- `[MINOR]` Manual smoke (live VS Code Agent flip) is not a task `verify:` — acceptable; DOM test encodes the contract; human done-criteria remain for post-implement eye check.

### Architect response
- `[MINOR]` intermediate red → **ACCEPTED**: order T1 then T2; do not claim done until T2 green.
- `[MINOR]` manual smoke → **ACCEPTED**: optional after implement; not blocking plan.

Outcome: clean
