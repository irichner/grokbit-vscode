# Assumptions — Grokbit Actions stay visible across Agent switch

## From intake
- Product requirement (user): default Grokbit Actions workflow tiles are the same for Grok and Claude agents. Matches code filter `CAPABILITY_VISIBLE_KINDS = ["grokbit"]` in `media/webview-helpers.js`.

## From grounding (Loop 2)
None — all entities for this bug path were resolved with citations.

## From adversarial review (Loop 3)
None outstanding — Round 1 MAJORs revised into design (required re-render contract; flip-only re-request gate).

## From verifiability (Loop 4)
None.

## Resolution
- Survey confirmed root cause: `backendChanged` clears capabilities without a same-panel re-request; tab reveal recovers via `initialState` → `listCapabilities`.
- Accepted residual: with `grok.actionsScope: "all"`, non-suite skills from the previous backend may show briefly until the flip’s scan returns.
