# Test results — changed-files-dedupe

Mode: verify · Baseline: pre-T1 suite (1408) + `test/baseline.md` · Change: `0ed75da`

## Regression

| # | Behavior | Before | After | Class | Evidence |
|---|---|---|---|---|---|
| 1 | One applied edit → 1 chip | PASS | PASS | — | `changed-files-strip.dom.test.ts` |
| 2 | Distinct paths → N chips | PASS | PASS | — | same |
| 3 | Fail removes by toolCallId | PASS | PASS | — | same |
| 4 | Clear on user message | PASS | PASS | — | same |
| 5 | No populate on replay | PASS | PASS | — | same |
| 6 | Chip openFile | PASS | PASS | — | same |
| 7 | Same path, two toolCallIds | 2 chips / label "2 files changed" (code inspection baseline) | 1 chip, `+3`/`−1`, "1 file changed" | INTENDED | `03-design.md` Option A; design Decision |
| 8 | Partial fail one of two same-path | n/a (no prior test) | remaining chip keeps other edit metrics | INTENDED | `03-design.md` unhappy paths |

## Project suite
Before: 1408 passed / 0 failed (see `implement/preflight.md`)
After: 1410 passed / 0 failed
New failures (regressions): none
Pre-existing failures (not ours): none
Excluded: none

## Done-criteria coverage
| Criterion | Check run | Result |
|---|---|---|
| Same path multi-edit → one chip | `npm test -- test/changed-files-strip.dom.test.ts` (same-path case) | PROVEN |
| Metrics sum all successful edits | same (`+3` / `−1`) | PROVEN |
| Distinct paths → two chips | existing multi-file case | PROVEN |
| Partial fail updates/removes contribution | partial-fail case | PROVEN |
| Empty hide, clear turn, no replay, open click | existing 6 cases | PROVEN |
| Automated suite green | `npm test` → 1410 | PROVEN |

Proven: 6 of 6 · Unverified: 0

## Visual
| View | Width | Result | Capture |
|---|---|---|---|
| `#changed-files` strip (DOM) | n/a | PROVEN via happy-dom | n/a — unit DOM, not screenshot |

No Playwright/headless browser campaign for this strip; DOM suite is the project standard for chat.js UI contracts.

## Maintenance sweep
- No orphan files from this session.
- No new dependencies.
- `removes:` fields were `none` — nothing scheduled for deletion left behind.
- Start-of-task snapshots under `implement/snapshots/` are local revert aids (untracked / not required in product tree).

## Baseline retirement
- B1 contracts 1–6 — unchanged; keep existing tests as characterization.
- Same-path multi-edit (B1 row 7) — INTENDED; covered by new permanent DOM tests (not separate baseline files). No separate baseline test file to retire.
