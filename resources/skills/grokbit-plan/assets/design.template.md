# Design — <title>

## Options considered

### Option A — <name>
Approach: <...>
Trade-off (against the intent's constraints): <...>

### Option B — <name>
Approach: <...>
Trade-off: <...>

## Decision
**Chosen: <A|B>**

Rationale against constraints: <...>

What the rejected option was better at: <...>
(Stated so the decision stays reversible when circumstances change.)

## Shape of the change
<Data model / control flow / component structure. Every claim about existing
code carries its citation from the survey.>

## Disposition of superseded code
Every item from the survey's supersession section. No item may be omitted —
the Reviewer treats silence as a MAJOR finding.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| `legacyResetToken` | REPLACE | new flow fully covers it | all 3 callers migrated, then the file deleted, once decomposition schedules both |
| `<Modal v1>` | DEPRECATE | 11 callers, only 2 in scope | marked; owner: <name>; remove by <date> |
| `formatDateShort` | COEXIST | different locale semantics | new code uses `formatDate`; documented for the next survey |
| `src/legacy/report.ts` | LEAVE | unrelated subsystem, no overlap | — |

DEPRECATE needs an owner and a date. "Later" is not a schedule.
COEXIST needs a reason permanent duplication is correct, not deferral reworded.

Obligation describes what must happen, not which task does it — no task IDs
exist yet at this step. `plan.md`'s own Disposition summary maps each row to
a concrete task once Decompose runs.

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Network failure | <...> |
| Empty state | <...> |
| Concurrent edit | <...> |
| Permission denied | <...> |

## Migration
Schema change: <yes/no>
Reversible: <...>
Existing rows: <...>
Mixed-version window: <...>

## New dependencies
| Package | Why nothing in-repo suffices | Size | License |
|---|---|---|---|
