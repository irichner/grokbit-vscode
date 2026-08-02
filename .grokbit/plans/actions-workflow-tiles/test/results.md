# Test results — actions-workflow-tiles

## Mode

**Reduced verify** — no formal `test/baseline.md` (Loop T6). Preflight suite was green (1338). Plan T2–T5 baselines were descriptive UI snapshots only. Regression claims vs characterization tests are limited; suite + done-criteria remain authoritative.

## Regression (Step 1)

Project suite after implement:
- **1347 passed**, 0 failed (floor was 1336; preflight 1338; net +9 from this work)
- `npx tsc -p . --noEmit` clean
- Pre-existing failures in preflight: **none**
- New suite failures introduced: **none** (D1 fixed mid-T6: `chat-layout` 260→300)

No formal baseline characterization tests to replay. Behavioral changes vs pre-change UI (INTENDED per design):

| Behavior | Classification | Citation |
|---|---|---|
| Skills/Agents/Commands no longer render in Actions | INTENDED | `03-design.md` Decision 1 A′ |
| Descriptions wrap multi-line, not ellipsis | INTENDED | `03-design.md` Decision 3 |
| Sentence-aware trim at 260 | INTENDED | `03-design.md` Decision 2 Option 1 |
| Empty copy names workflows | INTENDED | plan T5 / disposition REPLACE |
| Tile chrome on non-toggle rows | INTENDED | `03-design.md` Decision 3 |

## Done-criteria coverage (Step 2)

From `01-intent.md`:

| Criterion | Status | Evidence |
|---|---|---|
| New tab: exactly Grokbit workflow group, four steps order | **PASS** | `test/capabilities.dom.test.ts` suite group + filter; names order featured |
| Top-bar same four; no Skills/Agents/Commands | **PASS** | DOM tests + suite-absent rewrite |
| Bordered tiles; multi-line descriptions | **PASS (causes)** | CSS source checks; **manual look still required** for paint |
| Complete sentences, not mid-word … | **PASS** | real grokbit-plan assertion in webview-helpers tests |
| Multi-column wide / single narrow / no h-scroll | **UNVERIFIED (layout)** | happy-dom does not lay out; causes asserted (`min(100%, 300px)`, auto-fit) |
| Click seeds `/grokbit-plan `, no send | **PASS** | existing DOM case survives |
| Auto-accept still first in popover | **PASS** | session toggle tests |
| No workflows → honest muted line | **PASS** | empty-state tests + source checks |
| `npm test` green, no floor reduction | **PASS** | 1347 ≥ 1336 |

## Visual (Step 3)

**UNVERIFIED — no headless browser / no layout in happy-dom** for multi-column paint and tile appearance. Causes verified by CSS source tests. Plan T4 required one human look: open new session tab, confirm four tiles wrap; widen for multi-column; narrow split with no h-scroll.

## Maintenance sweep (Step 5)

Scoped to commits `c829b07`…`54c03de`:
- No orphan files from abandoned approaches
- No new dependencies
- `removes:` fields: cap values/clip behaviour replaced in place (not deleted files) — OK
- No session TODOs left in touched code

## Baseline retirement (Step 7)

Skipped — no formal baseline characterization tests; reduced mode.
