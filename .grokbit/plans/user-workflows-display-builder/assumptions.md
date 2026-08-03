# Assumptions — User Workflows display + Workflow Builder

## From intake

- Product override (this session): **form wizard + visual canvas + React Flow evaluation are in scope** (prior exclusion removed).
- Inferred: Builder Grok-first v1 (create-workflow skill); Claude no full builder unless gate says otherwise.
- Inferred: Craft default = **seed structured prompt**, user sends (not auto-send).
- `UNVERIFIED` Final canvas library (vanilla vs React Flow) — **ADR 0004** decides; both candidates in scope until Decision written.
- `UNVERIFIED` Auto-send Craft — gate may flip.

## From grounding (Loop 2)

- Confirmed: no React webview bundle today (`package.json` compile = `tsc` only).
- Confirmed: E6 required ADR before React Flow work — satisfied by T1, not skipped.

## From adversarial review (Loop 3)

- Surviving product risks logged as UNVERIFIED above; fallback paths:
  - React Flow rejected by ADR → vanilla canvas still ships (canvas stays in scope).
  - Canvas delayed → form-only Craft still better than bare slash (partial, not preferred).

## From verifiability (Loop 4)

- T5 verify depends on ADR file choices; if React Flow, implement must extend verify to include bundle build command once scripts exist.

## Resolution

Gate should pick or explicitly `defer-to-ADR-author` for canvas tech, Craft send mode, and Claude v1.
