# Review — Session tab status + progress

## Round 1 — Plan Reviewer (adversarial)

Inputs read: `01-intent.md`, `02-survey.md`, `03-design.md` (from disk). Spot-checks below.

### Findings

1. **[MAJOR] Progress source is under-specified for the done-criterion that requires a progress cue** — Design §2 says “tool_call / tool_call_update” and “exact event hooks chosen at implement time.” Survey correctly notes host progress fields DO NOT EXIST. Host *does* have `client.on("toolCall")` / `toolCallUpdate` at `src/sidebar.ts:2367-2375`, so hooks exist, but the design never states:
   - whether progress increments on `toolCall` start, on `toolCallUpdate` completed only, or both;
   - whether narration-only turns (no tools) still get a non-static working cue (status marker alone vs stuck at 0);
   - that `total` is almost never known today, so the shipped progress cue is **step count**, not a bar—intent wording “progress bar” may over-promise unless the design locks the user-visible shape (e.g. `↻ 7` or `…7`).

   **Resolve:** Specify: increment on first host-seen event for each distinct `toolCallId` (or on completed updates only—pick one); working title always shows the working marker even at 0 tools; progress segment appears only when `current ≥ 1`; never show fake `n/m` without a real total; document step-count as the v1 “progress bar” equivalent in plan notes.

2. **[MAJOR] “Finished while away” on the tab depends on unread meta, but `updateTabTitle` is not listed on the clear-unread path** — Design correctly ties done/error title to unread (`setStatus` `sidebar.ts:4614-4616`). Opening/revealing a tab clears unread for dots; if title is not refreshed on that clear, the tab would keep `✓`/`err` after the user looks at it—violating done-criterion “idle viewed tab has no permanent mark.”

   **Resolve:** Explicitly call `updateTabTitle` wherever unread is cleared (same sites that clear dots for open/reveal), not only inside `setStatus`.

3. **[MINOR] Title max length may need a bump** — Status segment + existing ~34 char budget risks unreadability. Design mentions hard max for status but does not decide whether `DEFAULT_SETTINGS_TITLE_MAX` increases (e.g. 34 → 40). Not a correctness bug if status wins budget first.

   **Resolve:** Pick a number in the plan task notes (recommend slight increase with tests).

4. **[MINOR] Icon path is COEXIST/optional** — Fine for scope; ensure done-criteria can pass on title alone (intent already says “title and/or icon”). No change required if plan gates on title.

5. **[MINOR] Circular import risk** — `SessionStatus` lives in `src/session.ts`; `composeTabTitle` in `src/sessions.ts`. Today `sessions.ts` may not import `session.ts`. Design should prefer a string union on `TabTitleParts` or a tiny shared type to avoid any cycle, or pass a tab-title-specific status enum (`"working" | "needs-you" | "done-away" | "error-away" | "none"`) computed in sidebar pure-friendly.

   **Resolve:** Prefer a pure view-model status for titles (recommended) so `sessions.ts` stays free of Session class coupling.

### Grounding spot-checks
- `SessionStatus` at `src/session.ts:8` — confirmed.
- `setStatus` does not call `updateTabTitle` — confirmed design gap.
- `composeTabTitle` end-truncation rationale `src/sessions.ts:184-187` — confirmed.
- `toolCall` host handlers `src/sidebar.ts:2367-2375` — confirmed (design should cite).

### Intent coverage
- Running / needs-you / done-away / idle clear: covered if findings 1–2 fixed.
- Progress cue: covered as step count if finding 1 fixed; not a true bar (aligned with non-goals).
- Launcher + status bar unchanged: covered (LEAVE).
- Unit tests: covered.

### Supersession table
All four survey supersession items have dispositions. No silent omission.

### Reinvention
None—extends existing composers and status choke points.

---

## Round 1 — Architect response

| Finding | Action |
|---|---|
| MAJOR progress under-specified | **Revised design** §2: lock increment rule, working-at-0, step-count v1, no fake totals |
| MAJOR unread clear without title refresh | **Revised design** §3: title refresh on unread clear / reveal |
| MINOR title max | **Revised design** §1: raise default budget to 40 with tests |
| MINOR icons optional | Accepted — title is gate |
| MINOR type coupling | **Revised design** §1: pure `TabTitleStatus` view-model, not raw `SessionStatus` import into sessions if cycle risk |

---

## Round 2 — Plan Reviewer

Re-read revised `03-design.md` after Architect edits (status view-model, locked progress increment/reset, unread-clear title refresh, budget 40 / status max 6).

### Findings
- Prior MAJOR #1 (progress under-specified) — **resolved** (toolCall id de-dupe, narration-only, step-count v1).
- Prior MAJOR #2 (unread clear) — **resolved** (explicit glue obligation).
- No new BLOCKER / MAJOR.
- MINOR residual: exact glyph set (`…` / `?` / `*` / `!`) is a product taste call; locked enough for tests.

**Loop 3 exit:** zero BLOCKER, zero MAJOR outstanding.

---

## Plan-level pass (Loop 4) — Plan Reviewer

Inputs: `plan.md`, `01-intent.md`, `03-design.md`.

### Checklist
- Every task has runnable `verify:` for this repo (`npm test -- …`) — yes (Windows-friendly).
- `cwd:` none for single-package — yes.
- Files named — yes.
- `depends:` T2→T1, T3→T2 — yes.
- `baseline:` present on all — yes.
- `removes:` none (net-additive surface) — yes, honest.
- Rollback stated — yes.
- `state-after: working` — yes.
- Verification matrix covers all done-criteria — yes.
- Disposition summary matches design (REPLACE title + setStatus behavior; optional icons; LEAVE dots) — yes.
- T3 correctly optional so scope does not inflate — yes.

### Findings
- **[MINOR]** T2 `verify:` is unit-only; multi-tab title chrome is host-impure. Acceptable if manual smoke is required before Ready:yes (noted in T2 notes). Not a BLOCKER.

**Loop 4 exit:** no BLOCKER. Plan is ready for the human approval gate.
