# Test results — <slug>

Mode: verify · Baseline: `<sha>` · Change: `<sha>`

## Reduced mode
Include this section, and state it plainly, whenever no baseline was on record
for this run — delete the section entirely when a real baseline exists. Never
let its absence be mistaken for "nothing to report" and never let its presence
be softened into "no regressions found."

**No baseline was captured for this change.** Regression detection did not
run — not "none found," "not measurable." Done-criteria coverage, visual
checks, security, and the build below were still checked normally.

## Regression
Skip this table entirely when `## Reduced mode` above applies — leaving it
with blank "Before" cells reads as checked when it was not.

| # | Behavior | Before | After | Class | Evidence |
|---|---|---|---|---|---|
| 1 | cart total, 3 items | $47.20 | $47.20 | — | — |
| 2 | discount applies | 10% | 15% | INTENDED | `03-design.md:34` |
| 3 | guest checkout | allowed | 403 | REGRESSION | `checkout.spec.ts:88` |
| 4 | email casing | preserved | lowercased | UNKNOWN | plan silent |

INTENDED requires a citation into `03-design.md`. No citation -> UNKNOWN.

## Project suite
Before: N passed / N failed (see `implement/preflight.md`)
After:  N passed / N failed
New failures (regressions): <list>
Pre-existing failures (not ours): <list>
Excluded (baseline test red behind an already-INTENDED finding above, same
`03-design.md` citation — not a regression, carried to Step 7 instead): <list>

Only a baseline characterization test behind a finding already classified
INTENDED in the Regression table above belongs on the excluded line. A red
baseline test behind a REGRESSION or UNKNOWN finding, or any other newly-red
test in the suite, stays on the New failures line.

## Done-criteria coverage
| Criterion | Check run | Result |
|---|---|---|
| Logged-out /dashboard redirects to /login | `curl -I ...` | PROVEN |
| Reset link expires after 1h | — | UNVERIFIED — no time control in test env |

Proven: N of N · Unverified: N

## Visual
Paths are relative to this file's own directory (`.grokbit/plans/<slug>/test/`).

| View | Width | Result | Capture |
|---|---|---|---|
| /settings | 1440 | PASS | `captures/settings-desktop-after.png` |
| /settings | 390 | FAIL — save button clipped | `captures/settings-mobile-after.png` |

No headless browser available: every row reads `UNVERIFIED — no headless
browser`, with no capture, rather than being omitted from this table.

## Triage — failure #3
Minimal repro: <smallest failing path>
Runtime state at failure: `user.role = undefined` (expected `'guest'`)
Hypotheses, ranked:
1. <cause> — evidence: <...> — confirm by: <...>
2. <...>
Handed to: grokbit-implement

## Maintenance sweep
Non-blocking cleanup list. "This session" means the commits listed under
Completed in `implement/handoff.md`.
- `src/lib/authOld.ts` — orphaned, superseded by T2, no importers
- `lodash` — added this session, now unused

## Baseline retirement
Only after the verdict in `test/release-readiness.md` is SHIP or SHIP WITH
CAVEATS, and only for findings above already classified INTENDED. Leave this
section empty (not omitted) when no INTENDED findings exist.
- B2 (discount applies) — REGENERATED to assert 15% — cites `03-design.md:34`
- B5 (legacy export flow) — RETIRED, design removed the behavior — cites `03-design.md:41`
- B7 (rate-limit header) — NOT RETIRED — hit Loop T7 cap, needs a human look
