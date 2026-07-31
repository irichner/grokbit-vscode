# Survey — <title>

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| User model | EXISTS | `src/db/schema.ts:14` |
| Password reset endpoint | DOES NOT EXIST | searched: `reset`, `forgot`, `recover` |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- `formatCurrency` — `src/lib/money.ts:8` — handles cents→display, already locale-aware
- <...>

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts are required —
they determine whether removal is a footnote or its own task. In a very large
repo, `≥50 (capped)` is a valid count — say so rather than enumerating past
the point it stops being reliable.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| `legacyResetToken` | `src/auth/reset.ts:12` | 3 | new flow replaces it entirely |
| `<Modal v1>` | `src/ui/Modal.tsx:1` | 11 | partially — new dialog only covers settings |

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- `src/auth/resetV2.ts` — appears abandoned, zero importers, last touched 8 months ago
- <or: none found>

## Conventions
How this repo actually works, with an example of each.

- **Errors:** <pattern> — `path:line`
- **Tests:** <framework, location, naming> — `path:line`
- **State:** <pattern> — `path:line`
- **Layout:** <pattern>

## Absences
Missing infrastructure the plan may need to add.

- <e.g. no test runner configured; package.json has no test script>

## Danger zones
- `path` — imported by N modules, no test coverage
- `path` — generated file, do not edit by hand
