# Plan — Grokbit Actions stay visible across Agent switch

Slug: `actions-survive-agent-switch` · Approach: keep capabilities on `backendChanged` + re-request only on real Agent flip · Blast radius: 2 files (webview + one DOM test), 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Stop wiping Grokbit Actions on Agent flip; re-request only when backend changes
- **intent:** When the host posts `backendChanged` after Session Setup Agent switch, the welcome Grokbit Actions panel stays visible (retained tiles) and a true Grok↔Claude flip posts `listCapabilities` so discovery stays correct.
- **files:** `media/chat.js`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/capabilities.dom.test.ts` (must pass after T2; after T1 alone, expect the old clear-on-backendChanged test to fail until rewritten)
- **removes:** `state.capabilities = null` and `hideCapabilitiesPanel()` from the `backendChanged` case in `media/chat.js` (approx. lines 5562–5567); update the adjacent comment that justified wipe-for-wrong-backend skills
- **baseline:** On empty welcome tab, Agent switch currently blanks Actions until tab hide/reveal (bug). Other Agent UI (chip, model/thinking, placeholder) still updates via existing handlers.
- **rollback:** `git checkout -- media/chat.js`
- **state-after:** working (old regression test may be red until T2)
- **notes:** Citations: clear/hide `media/chat.js:5558-5578`; Agent post `media/chat.js:521-523`; host same-panel restart `src/sidebar.ts:638-645`; no `ready` on flip. Contract from `03-design.md`: capture `prevBackend` before assign; never null/hide for this message; re-request iff `showCapabilities && backend !== prevBackend`; then `renderCapabilitiesPanel()` + open popover body if open.

### T2 — Rewrite regression test for stay-visible + flip-only re-request
- **intent:** Encode the new contract so a future “clear on backendChanged” regresses red, and prove same-backend `backendChanged` does not spam `listCapabilities`.
- **files:** `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/capabilities.dom.test.ts`
- **removes:** assertion block titled approximately “backendChanged clears a retained capabilities payload from the previous backend” (`test/capabilities.dom.test.ts:374-392`)
- **baseline:** none (test-only change after T1)
- **rollback:** `git checkout -- test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:** Cases: (1) capabilities shown → flip backend → panel still visible + one `listCapabilities`; (2) same-backend `backendChanged` → no extra request; (3) existing first-send hide and `showCapabilities:false` tests still green.

### T3 — Full suite green
- **intent:** Confirm no collateral break in session-setup, backend-chip, or other capabilities tests.
- **files:** none (verification only)
- **cwd:** none
- **depends:** T2
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** n/a
- **state-after:** working
- **notes:** Windows/PowerShell: run from repo root. Floor is the project’s full grok-free suite.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Agent switch leaves Actions visible (no permanent gone) | T2 DOM test + manual smoke after implement |
| Same workflow tiles without tab reselect | T1 retention + T2; product suite filter unchanged |
| Agent-specific UI still updates | Existing backend-chip / session-setup tests remain in T3; T1 does not remove label updates |
| Automated regression for blank-on-flip | T2 |
| `npm test` green | T3 |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 | T1 (clear+hide policy), T2 (old regression test) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 0 | — |

Net lines: small negative in wipe logic, small positive in re-request gate + test rewrite. Not net-additive feature work — bugfix + contract flip.

## Open assumptions
Full ledger: `assumptions.md`.

- Product: default Grokbit Actions workflow tiles are agent-independent (user requirement; matches `CAPABILITY_VISIBLE_KINDS`).
- `actionsScope: "all"` may briefly show previous backend’s non-suite skills until scan returns — accepted, not a done-criterion.

## Approval
- [x] Human approved — 2026-08-01 (user: "approve")
