# Review log — Changed-files strip: one chip per file

## Loop 3 — Round 1 (Plan Reviewer)

### Grounding spot-check
- Opened `media/chat.js` around `recordChangedFile` / `renderChangedFilesStrip`: Map is toolCallId-keyed; render iterates all values with no path group — matches survey root cause.
- Opened `test/changed-files-strip.dom.test.ts`: multi-file test uses distinct paths only; no same-path case — matches survey absence.
- Opened `markToolFailed` → `forgetChangedFile(toolCallId)` — confirms Option A leave storage key correct.

### Findings

- [MAJOR] Intent done-criterion requires metrics to include **all** successful edits; design Option A sums adds/dels — good — but design does not specify **how to assert sums in the test** (which old/new strings produce known +/−). Resolve: plan tasks must use fixed fixtures with expected totals derived from existing `countDiffLines`/`computeLineDiff` behavior (same as first test's +2/−1).
- [MAJOR] Failure partial-removal criterion is in intent but design only sketches "second edit then first fails" as optional. Resolve: make partial forget a **required** test case in plan (not optional).
- [MINOR] Path normalization LEAVE is fine; document at gate that `src/a.ts` vs `src\a.ts` would still be two chips if the agent emitted both.
- [MINOR] No BLOCKER on approach A; supersession dispositions present for all survey rows.

### Intent drift
- Non-goals respected (no CSS redesign, no true-net merge, no host changes).

### Reinvention
- None; reuses existing Map + render.

### Undeclared supersession
- All survey supersession items have dispositions.

---

## Loop 3 — Round 1 response (Architect)

- Test fixtures: use two sequential edits with known diffs, e.g. path `src/auth.ts`:
  - Edit e1: `"a\nb\nc"` → `"a\nB\nc\nd"` → +2 −1 (same as existing test)
  - Edit e2: `"a\nB\nc\nd"` → `"a\nB\nc\nd\ne"` → +1 −0
  - Aggregate expect: one chip, `+3` and `−1`, label `1 file changed`
- Partial forget: after both recorded, fail `e1` only → remaining chip shows e2 metrics only (`+1`); fail both → strip empty. Required in plan T2.
- MINOR path-normalization note carried to assumptions / gate — no design change.

Revised design notes absorbed into `03-design.md` (tests section already required same-path + partial fail; plan will harden).

---

## Loop 3 — Round 2 (Plan Reviewer)

Re-read `03-design.md` + intent.

### Findings
- [MINOR] Order of chips: "first-seen" is specified; good enough; no product requirement for alpha sort.
- Zero BLOCKER / zero MAJOR remaining after Round 1 fixes are accepted into the task list.

**Exit Loop 3:** clean for implementation planning.

---

## Loop 4 — Plan-level pass (after `plan.md`)

### Checks
- Every task has runnable `verify:` on Windows-friendly `npm test -- <file>` from repo root (`cwd: none`).
- Verification matrix covers all six done-criteria.
- Disposition summary matches design: LEAVE storage key; REPLACE display aggregation + comment.
- T1 is test-first failing case; T2 implements A; T3 full suite regression — order leaves working state after T2 if T1's new test is red only until T2 (T1 may land failing test — note: **state-after breaks-build** only if committed mid-way; prefer single implement slice T1+T2 in one PR/session, or T1 write test + T2 implement in same commit). Plan orders T1 test then T2 fix with note that green gate is after T2.

### Findings
- [MAJOR] T1 alone leaves suite red if merged alone — violates "working state after each task where possible." Resolve: merge T1+T2 into one task **or** mark T1 `state-after: breaks-build` explicitly at gate. Architect chose **combined T1** (failing test + fix in one task) with optional split note — actually better: **T1 add failing test + implement fix together** as single task so every commit is green; separate T2 only for full-suite + docs comment polish.

Architect revision: single implementation task with test-first inside it; second task regression + comment clarity if needed.

### Loop 4 Round 2
- Plan rewritten to T1 (test + fix, green) + T2 (full suite confirm / comment). Zero BLOCKER.
