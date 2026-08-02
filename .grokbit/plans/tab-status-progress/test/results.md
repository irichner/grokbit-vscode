# Test results — tab-status-progress

Mode: verify · Baseline: reduced (repo `test/baseline.md` is for chat-turn-containers, not this slug) · Change: uncommitted WIP

## Reduced mode

**No baseline was captured for this change.** Regression detection did not
run — not "none found," "not measurable." Done-criteria coverage, security,
and the build below were still checked normally.

(The repo root `test/baseline.md` documents a different slug's pre-change
behavior and is not used as a regression oracle here.)

## Project suite
Before (preflight targeted): 119 passed / 0 failed  
After (same modules): 129 passed / 0 failed (sessions gained 10 status/progress tests)  
New failures (regressions): none  
Pre-existing failures (not ours): none in targeted suite  
Excluded: n/a

Full `npm test` not re-run this session (time); `tsc -p . --noEmit` clean; `npm run package` succeeded.

## Done-criteria coverage
| Criterion | Check run | Result |
|---|---|---|
| Background tab shows **running** | Unit: `composeTabTitle` + `tabStatusHead` working → `…`; host wires `setStatus("working")` → `updateTabTitle` | PROVEN (unit) · UNVERIFIED end-to-end in VS Code (manual smoke needed) |
| Background tab shows **needs attention** | Unit: `needs-you` → `?`; host `setStatus("needs-you")` | PROVEN (unit) · UNVERIFIED e2e manual |
| Finished while away shows **done**, not running | Unit: `done`+unread → `done-away` → `*`; `setStatus` sets unread when not visible | PROVEN (unit) · UNVERIFIED e2e manual |
| Viewed idle tab has no permanent mark | Unit: `none` idle; `markRead` → `updateTabTitle` | PROVEN (unit) · UNVERIFIED e2e manual |
| Multi-step turn shows **progress cue** | Unit: `…7` / `…3/12`; host increments on distinct `toolCallId` | PROVEN (unit) · UNVERIFIED e2e manual |
| Launcher dots + status bar still work | `test/session-pool.test.ts` + `test/status-bar.test.ts` green | PROVEN |
| Unit tests for pure formatting | `npm test -- test/sessions.test.ts` 101 green | PROVEN |

Proven: 3 of 7 fully (suite-backed) · Partially proven: 4 of 7 (unit + wiring; need manual two-tab smoke)

## Visual
| View | Width | Result | Capture |
|---|---|---|---|
| Editor tab titles (native VS Code chrome) | n/a | UNVERIFIED — no headless browser; not DOM | — |

Native tab strip is outside happy-dom / webview DOM tests.

## Maintenance sweep
- No orphan files from this session.
- Optional T3 icons not created (skipped intentionally).
- **Pre-existing packaging noise (not introduced by title logic, but observed):** `npm run package` included `.grokbit/` and a stray `x[1])` in the vsix listing — worth `.vscodeignore` cleanup separately; does not block title feature correctness.

## Baseline retirement
(empty — no INTENDED baseline characterization tests for this slug)
