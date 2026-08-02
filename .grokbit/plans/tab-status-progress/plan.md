# Plan — Session tab status + progress

Slug: `tab-status-progress` · Approach: native editor-tab title status prefix + host tool-step progress · Blast radius: ~5–7 source/test files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Pure tab title status + progress formatting
- **intent:** `composeTabTitle` (or co-located pure helpers) encodes `TabTitleStatus` + optional step progress as a leading segment with locked budgets and idle backward-compatible titles
- **files:** `src/sessions.ts`, `test/sessions.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/sessions.test.ts`
- **removes:** none
- **baseline:** existing `composeTabTitle` / `tabTitleFor` outputs for idle sessions (name, model, effort, backend, truncation) — capture via current tests before changing expectations for long-name budget only
- **rollback:** `git checkout -- src/sessions.ts test/sessions.test.ts`
- **state-after:** working
- **notes:** Design §1 — `TabTitleStatus` = `none|working|needs-you|done-away|error-away`; markers `…` `?` `*` `!`; status max 6 chars; `DEFAULT_SETTINGS_TITLE_MAX` 34→40; progress only when working and current≥1; cite `src/sessions.ts:190-199`. Prefer pure `tabTitleStatusFrom` if it keeps sidebar thin. Do not import `Session` class into `sessions.ts`.

### T2 — Session progress fields + setStatus / toolCall / unread-clear title refresh
- **intent:** Live panel titles update on status changes, on new tool-call steps while working, and when unread is cleared so background tabs show running / needs-you / done-away / idle correctly
- **files:** `src/session.ts`, `src/sidebar.ts`, optionally `src/session-pool.ts` if `tabTitleStatusFrom` lands there
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/sessions.test.ts test/session-pool.test.ts`
- **removes:** none
- **baseline:** `setStatus` still drives dots + status bar (`src/sidebar.ts:4606-4618`); launcher dots and status-bar behavior unchanged; idle tab titles still settings-prefix only when status none
- **rollback:** `git checkout -- src/session.ts src/sidebar.ts src/session-pool.ts`
- **state-after:** working
- **notes:** Design §2–3 — hook `client.on("toolCall")` at `src/sidebar.ts:2367` for de-duped step increments; `updateTabTitle` passes tabStatus+progress; call `updateTabTitle` from `setStatus` and every unread-clear/open-reveal path; reset progress per design. Manual smoke (not CI): two tabs — run turn in A while focused on B; assert A title shows `…` then step counts; permission on A shows `?`; finish A in background shows `*`; focus A clears `*`.

### T3 — Optional status tab icons (deferrable)
- **intent:** If title-only cues feel weak after T2 smoke, swap `panel.iconPath` for working/needs-you/error variants while idle keeps brand blackhole pair
- **files:** `src/sidebar.ts`, optional new SVGs under `resources/`, tests only if pure icon-choice helper extracted
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/sessions.test.ts` (suite still green; icon choice pure unit test if extracted)
- **removes:** none
- **baseline:** brand icons at bind (`src/sidebar.ts:736-740`)
- **rollback:** restore static blackhole `iconPath` assignment
- **state-after:** working
- **notes:** Design disposition COEXIST/optional. **Skip T3** if human smoke after T2 already meets done-criteria on titles alone. Do not block merge on T3.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Background tab shows **running** | T1 unit cases for `working`; T2 wiring + manual two-tab smoke |
| Background tab shows **needs attention** | T1 `needs-you` → `?`; T2 `setStatus("needs-you")` → title |
| Finished while away shows **done**, not running | T1 `done-away` → `*`; T2 unread + title; clear on reveal |
| Viewed idle tab has no permanent running/needs mark | T1 `none`; T2 unread-clear → `updateTabTitle` |
| Multi-step turn shows **progress cue** (not only static working) | T1 progress segment; T2 toolCall increments |
| Launcher dots + status bar still work | T2 baseline; existing `test/session-pool.test.ts` / status-bar tests if touched |
| Unit tests for pure formatting | T1 `npm test -- test/sessions.test.ts` |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE (in place) | 2 | T1 `composeTabTitle`; T2 `setStatus`/title refresh behavior |
| COEXIST / optional | 1 | T3 status icons (or skip) |
| LEAVE | 1 | Launcher/history dots unchanged |

Net lines: expected small (+~80–150 pure/tests, +~40–80 glue). Net-additive is correct: this is a new surface on existing status, not a duplicate status system.

## Open assumptions
This is a pointer, not a copy — the full ledger is `assumptions.md`.

- `UNVERIFIED` needs-you ≡ existing host status; done ≡ finished-while-away (unread), not permanent check while focused
- `UNVERIFIED` step-count title is the accepted v1 “progress bar”
- Glyph set `… ? * !` may be tuned at implement if unreadable on Windows tab chrome — keep tests in sync

## Approval
- [x] Human approved — 2026-08-01 (user: "/grokbit-implement this plan")
