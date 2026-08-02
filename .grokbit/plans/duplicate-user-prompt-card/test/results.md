# Test results — duplicate-user-prompt-card

Mode: verify · Baseline: `test/baseline.md` (chat-turn-containers era) + plan T1 baseline + `implement/snapshots/*.start` · Change: working tree (no commit)

## Regression

| # | Behavior | Before | After | Class | Evidence |
|---|---|---|---|---|---|
| 1 | Active turn shows header chrome (chevron + summary) and full `.msg.user` | Both surfaces visible (dual card) | Header hidden via CSS while `.active`; one `.msg.user` | INTENDED | `03-design.md` Option A; `media/chat.css` `.turn.active .turn-header { display: none }` |
| 2 | Prior turn collapses on next send | Header + hidden body | Unchanged structure; header visible again without `.active` | — (stable) | `test/chat-turn-containers.dom.test.ts` collapse case |
| 3 | Sticky `.turn-prompt` on active | Sticky CSS present | Unchanged | — (stable) | `media/chat.css` `.turn.active .turn-prompt` |
| 4 | Seal removes intermediate activity | Destroy activity | Unchanged | — (stable) | suite green activity-carousel + turn tests |
| 5 | Flat transcript (pre turn-containers baseline) | Flat `#messages` children | Still turn containers (from prior feature) | INTENDED (prior plan) | Not reintroduced by this slug; this change only hides active header |

INTENDED dual-prompt fix cites design Option A (hide header while active).

## Project suite
Before: turn-container suite 9 passed (preflight); full suite not re-run in preflight  
After: 1392 passed / 0 failed (64 files)  
New failures (regressions): none  
Pre-existing failures (not ours): none recorded  
Excluded: none

## Done-criteria coverage
| Criterion | Check run | Result |
|---|---|---|
| DC1 Single prompt on active turn after send | `npm test -- test/chat-turn-containers.dom.test.ts` — active header CSS `display: none` + one `.msg.user` | PROVEN |
| DC2 Sticky active prompt still works | CSS rule `.turn.active .turn-prompt` sticky retained; bubble present in DOM test | PROVEN (class/CSS contract; happy-dom has no pixel sticky) |
| DC3 Prior turns still collapse | second-send test: prior `.collapsed`, body hidden, summary text | PROVEN |
| DC4 Expand control only where needed | header hidden while active (CSS); present when not active | PROVEN |
| DC5 Replay parity | existing replay test still green; shell CSS applies to all turns | PROVEN (suite) |
| DC6 `npm test` green | `npm test` → 1392 passed | PROVEN |

Proven: 6 of 6 · Unverified: 0 (with note: DC2 sticky is CSS contract, not pixel layout)

## Visual
| View | Width | Result | Capture |
|---|---|---|---|
| Session chat webview — active send | editor tab | UNVERIFIED — no headless browser | — |
| Session chat webview — multi-turn collapse | editor tab | UNVERIFIED — no headless browser | — |

No headless browser for VS Code webviews in this environment. Manual check recommended after rebuild/install.

## Maintenance sweep
- No orphan files created this session.
- Snapshots under `implement/snapshots/` are intentional implement tooling (not product debris).
- Plan `removes:` was behavior-only (visible dual prompt) — confirmed via CSS + tests; no undeleted code scheduled for deletion.

## Baseline retirement
- B1 (dual prompt visible) — no separate characterization test file beyond turn suite; turn suite now asserts the post-change contract. No baseline test to retire.
- Pre-existing `test/baseline.md` (flat transcript) remains historical for the earlier turn-container feature; not edited here (would be out of scope for this verify step and owned by that prior plan).
