# Plan — Changed-files strip: one chip per file

Slug: `changed-files-dedupe` · Approach: path-aggregate at render, sum metrics, keep toolCallId storage · Blast radius: 2 files (chat.js + DOM test), 0 deps, no schema

## Tasks

### T1 — Dedupe strip by path and cover with DOM tests
- **intent:** When multiple applied edits share a path in one turn, the changed-files strip shows one chip with summed `+`/`−` metrics; partial tool failure removes only that edit's contribution; existing strip contracts stay green.
- **files:** `media/chat.js`, `test/changed-files-strip.dom.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/changed-files-strip.dom.test.ts`
- **removes:** none (behavior REPLACE for display aggregation only; no file deletion)
- **baseline:** Changed-files strip: one chip per applied toolCallId (including duplicate paths); fail removes by toolCallId; clear on user message; skip replay; multi-distinct-path label — captured by existing tests in `test/changed-files-strip.dom.test.ts` before edit
- **rollback:** `git checkout -- media/chat.js test/changed-files-strip.dom.test.ts`
- **state-after:** working
- **notes:**
  - **Root cause:** `recordChangedFile` keys `state.changedFiles` by `toolCallId` (`media/chat.js:3476`); `renderChangedFilesStrip` emits one chip per Map value (`:3492–3521`) with no path grouping.
  - **Fix (Option A):** In `renderChangedFilesStrip`, aggregate Map values by `path`, sum `adds`/`dels`, label = unique path count. Leave `record`/`forget`/`clear` toolCallId-based.
  - **Tests to add** (same harness style as existing):
    1. Two toolCallIds, same path `src/auth.ts`:
       - e1: old `"a\nb\nc"` → new `"a\nB\nc\nd"` → expect +2 −1 alone
       - e2: old `"a\nB\nc\nd"` → new `"a\nB\nc\nd\ne"` → +1
       - After both: 1 chip, label `1 file changed`, text contains `+3` and `−1`
    2. After both, fail e1 only: still 1 chip with `+1` (e2 only); fail e2 too: strip empty/hidden
    3. Existing six cases must remain green
  - Update state comment at `media/chat.js:136–139` to say storage is per applied edit / toolCallId; UI aggregates by path.

### T2 — Full suite regression
- **intent:** Confirm no collateral breakage outside the strip tests.
- **files:** none required (run only)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test`
- **removes:** none
- **baseline:** none (read-only gate)
- **rollback:** n/a
- **state-after:** working
- **notes:** Floor is the green suite; no coverage tool in repo.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Same path multi-edit → one chip | T1: new same-path test |
| Metrics sum all successful edits | T1: expect `+3` / `−1` on fixtures above |
| Distinct paths → two chips / plural label | T1: existing multi-file test |
| Partial fail updates/removes contribution | T1: fail-one-of-two test |
| Empty hide, clear turn, no replay, open click | T1: existing tests still green |
| Automated suite green | T1 + T2 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 | T1 — display aggregation; state comment |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 1 | toolCallId Map storage for forget/clear (by design) |

Net lines: small (+tests, ~15–30 lines in render). Not net-additive feature surface; display bugfix.

## Open assumptions

See `assumptions.md` (ledger). Summary:

- Sum metrics across edits (not latest-only, not true-net merge).
- Same-path multi-edit is the primary bug (not basename collision across dirs).
- Agent path strings for the same file are identical within a turn.

## Approval
- [x] Human approved — 2026-08-01 (user: `/grokbit-implement this plan`)
