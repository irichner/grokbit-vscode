# L4 Plan mode

## Reviewed

- `src/grok-primer.ts` full (v4 text + patterns)
- `src/plan-restore.ts` full
- `src/plan-review.ts` (filename helpers — light)
- `src/mode-prefs.ts` (light)
- Consistency with L1 gate integration

## Findings

### [Minor] Restore after “abandoned” / “approved” drops plan gate

- **Where:** `decideRestoreState` `plan-restore.ts:45-49` — only `rejected` restores planActive.
- **Why:** Intentional (safer than wrongly re-raising). Documented in file header. Users who abandon mid-plan without reject may resume in act mode with incomplete plan.
- **Fix:** Product choice; ensure UI makes last verdict clear on resume (existing plan history restore tests).

## Clean / solid

- Primer v4 correctly forbids tools and one-word ack (`grok-primer.ts:63-80`).
- Verdict protocol lives in follow-up markers, not tool result — matches host primer design.
- `clientPlanPermissionReject` grok-only avoids clobbering Claude native plan UX (`backends.ts:58-64`).
