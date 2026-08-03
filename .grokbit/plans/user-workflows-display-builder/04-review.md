# Review log — User Workflows display + Workflow Builder

Append-only. Never overwrite a previous round.

## Round 1 (superseded scope — display + seed only)

Reviewed: prior intent/design that excluded canvas.

- Scope exclusion of visual canvas / form wizard / React Flow — **product rejected**; see Round 3.

## Round 2 (invokeLabel multi-line)

- `[MAJOR]` Multi-line invoke chip pollution — **REVISED** in design: `capabilityInvokeLabel` first token of first line.

## Round 3 (scope expansion: builder + canvas in)

Reviewed: revised `01-intent.md`, `02-survey.md`, `03-design.md`

- `[MAJOR]` React Flow without ADR violates E6 gate (`docs/plans/grokbit-business-studio-3.0.md:300-317`) — resolves by: T1 ADR mandatory before canvas implementation.
- `[MAJOR]` No webview bundler today (`package.json` tsc-only) — React Flow path must cost a real packaging task, not a hidden dep — resolves by: ADR + T5 notes include bundler/CSP if Flow chosen.
- `[MINOR]` Auto-send vs seed-only still open — gate checkbox.
- `[MINOR]` Claude builder scope open — gate checkbox.
- Intent drift check: form + canvas + display all in done-criteria — OK.
- Non-goals still exclude extension runtime engine — OK (thin client).

### Architect response — Round 3

- `[MAJOR]` ADR → **REVISED**: T1 first-class; T5 depends on T1 Decision.
- `[MAJOR]` bundler → **REVISED**: design Option C + T5 notes; vanilla path zero deps if ADR picks it.
- Gate checkboxes for Craft send + Claude + canvas preference.

## Round 4

Spot-check citations: `webview-helpers.js:980-982`, `chat.css:2125-2127`, `withCreateWorkflowTile` — still accurate.

- No new BLOCKER/MAJOR.

## Outcome

Rounds used: 4 (including supersession). Outstanding: product gate prefs in `assumptions.md`.

## Plan review (Loop 4)

Reviewed: revised `plan.md`

- Done-criteria A+B map to T1–T6 verification matrix — OK.
- Disposition includes E6 status REPLACE — OK.
- T5 verify may need extension when React scripts appear — noted in assumptions.
- No BLOCKER.

Outcome: clean for approval pending human gate prefs.
