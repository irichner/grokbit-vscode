# Plan — Session setup always available at top of tab

Slug: `session-setup-top-bar` · Approach: top-bar summary chip → dual-anchor shared popover · Blast radius: ~6 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Dual-anchor session-settings popover placement
- **intent:** One `#session-settings-popover` opens correctly from a **top-bar** anchor (below chip, left-clamped) and from the **composer** `#model-label` (existing above-button placement), via re-parent-on-open + branched positioner.
- **files:** `media/chat.js`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/model-chip.dom.test.ts`
- **removes:** none
- **baseline:** Composer model chip still opens Agent/Model/Thinking/Mode popover above the chip (`test/model-chip.dom.test.ts` behavior today).
- **rollback:** `git revert` the commit (or restore `openSessionSettingsPopover` / `positionPopover` call site).
- **state-after:** working
- **notes:** Survey danger zone + Round 1 BLOCKER. Implement `positionSessionSettingsFromTop` (name flexible) and branch inside `openSessionSettingsPopover` (`media/chat.js:667–674`). Do not use right-align-only `positionDropdownPopover` for the left chip. Cite design §2 dual-anchor table.

### T2 — Pure chip label helper
- **intent:** Single pure function builds short chip segments (Grok/Claude · model · optional effort · Agent/Plan/Auto) so unit tests pin omit rules without DOM.
- **files:** `media/webview-helpers.js`, `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/webview-helpers.test.ts`
- **removes:** none
- **baseline:** none (additive pure helper)
- **rollback:** delete helper + tests
- **state-after:** working
- **notes:** Export from helpers; agent short form mirrors `updateBackendLabel`; mode shorts map SETUP_MODE_OPTIONS ids with yolo→`Auto` and full label available for title. Claude/empty effort omits thinking segment. Can run parallel with T1.

### T3 — Top-bar chip shell, CSS, paint, wire, truth table
- **intent:** Always-available (when model known) left top-bar chip shows session summary, opens dual-anchor popover, respects frozen visibility/lock table; welcome card still clears on first send.
- **files:** `src/sidebar.ts`, `media/chat.js`, `media/chat.css`, `test/webview-harness.ts`
- **cwd:** none
- **depends:** T1, T2
- **verify:** `npm test -- test/session-setup.dom.test.ts test/model-chip.dom.test.ts test/chat-layout.dom.test.ts`
- **removes:** none (comment text only may change)
- **baseline:** Welcome session-setup card hides on first send (`test/session-setup.dom.test.ts:107–112`); top-bar layout packs utilities end; no top session chip yet.
- **rollback:** remove chip from getHtml/harness/CSS; drop chip JS paths
- **state-after:** working
- **notes:** Design §1 shell (`margin-left: auto` on history or right cluster), §3–§6. `aria-haspopup` + `aria-expanded`. Extend `refreshSessionSettingsMounts` + optimistic effort path. Update CSS “TWO mounts” comment → three surfaces. No `@media`. Do not change `clearWelcome` card hide semantics.

### T4 — DOM tests for top-bar chip
- **intent:** Prove post-send chip visibility, open→four rows, dual-anchor parent/branch, busy lock, Claude omit, onboarding hide — without weakening welcome-card hide test.
- **files:** `test/session-setup-chip.dom.test.ts` (new)
- **cwd:** none
- **depends:** T3
- **verify:** `npm test -- test/session-setup-chip.dom.test.ts test/session-setup.dom.test.ts test/model-chip.dom.test.ts`
- **removes:** none
- **baseline:** none (new tests); suite must still match T3 baselines
- **rollback:** delete new test file
- **state-after:** working
- **notes:** Design named tests 1–8; dual-anchor assert prefers parentNode / open branch over pixel geometry in happy-dom (Round 2 nit).

### T5 — Release-facing docs one-liner
- **intent:** README/CLAUDE (or architecture) mention mid-session Session setup via top-bar chip so product map matches UI.
- **files:** `README.md` and/or `CLAUDE.md` (session setup bullets only)
- **cwd:** none
- **depends:** T3
- **verify:** Manual: open README session-setup section contains “top” or “top-bar” / Session setup chip wording; `npm test` still green if no code change
- **removes:** none
- **baseline:** none
- **rollback:** revert doc lines
- **state-after:** working
- **notes:** Disposition REPLACE for docs. Keep terse. Optional same PR as T3/T4.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| After first prompt, still open Agent/Model/Thinking/Mode | T3 + T4 tests 1–2 |
| Access from top of session tab | T3 shell + T4 chip click |
| Minimal vertical space (no multi-row card after chat starts) | Design Option A; T3 CSS — chip in existing top-bar; T4 no second strip assert optional |
| Mid-session controls + lock-while-busy | T1 reuse pick path; T4 busy lock case |
| Empty tabs still clear Session setup | T3/T4 + existing `session-setup.dom.test.ts` |
| Existing tests green + new coverage after first send | T1/T2/T4 verify commands |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T1 (composer-only positioner cannot own top open); T3 (CSS “TWO mounts” comment → three surfaces); T5 (README/CLAUDE mid-session line) |
| DEPRECATE | 0 | — |
| COEXIST | 1 | Bottom `#model-label` — T1+T3 keep path; T4 regression |
| LEAVE | 2 | Welcome card; backend/mode buttons — no task |

Net lines: expected small additive UI (~+150–250) with no large deletions.

## Open assumptions
See `assumptions.md`. None block implement if dual-anchor is followed.

## Approval
- [x] Human approved — 2026-08-02 (user: `/grokbit-implement this plan`)
