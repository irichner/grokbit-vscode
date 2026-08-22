# Review Report
- Target: plan
- Paths: `docs/plans/plan-mode-blocked-command-freeze.md`
- Pass: 1
- Overall: Request Changes
- Hard gates:
  - 1 Goal + acceptance criteria: **pass** (AC 1–9 are falsifiable; screenshot command, mutating `;` stage, braces, write carve-out, dead-frame, coalesce, `npm test` + coverage)
  - 2 Non-goals: **pass** (`{ }`/iex, dummy terminal, recursive GCI, skill-prose, `.grokbit/hooks` / arbitrary `.grokbit/**`)
  - 3 Risk / blast radius: **pass** (`plan-gate.ts` security-sensitive, `chat.js`/`chat.css`, named tests; worst case = too-wide allowlist; no data/auth)
  - 4 Ordered steps + per-step verification: **fail** (T1/T2/T4 are checkable; T3 names load-bearing order/CSS that the listed DOM command cannot observe)
  - 5 Testing strategy: **fail** (good classifier negatives; missing tests for wrap CSS, `isPlanFileWrite` non-expansion, and coalesce-before-`finalizeActivity`)
  - 6 Failure modes: **pass** (quoted-`;` fail-closed, `..` escape, coalesce key, priming no-op, revert three files)
  - 7 Observable verification: **pass** (unit strings, DOM selectors, manual `/grokbit-plan` freeze check, approach-B escape hatch)
  - 8 UI/UX design: **pass** (state inventory, `.plan-notice` + `.grokking` pattern, tokens, a11y `aria-label`, overflow rule named; not “looks good”)
- Required Changes:
  1. **[gap]** **T3: freeze coalesce order and turn scope.** Today `addPlanNotice` always `finalizeActivity()` then `hideGrokking()` (`media/chat.js`). `finalizeActivity` closes the live tool group and **removes** the carousel (`el.remove()`). If coalesce runs after that, a duplicate `planBlocked` still tears down live activity. Specify: (a) look up the last `.plan-notice` under `state.activeTurnEl` (fallback `#messages`); (b) on same-text hit, **do not** finalize/hide — only `ensureActivityIndicator()` and return; (c) insert path keeps finalize → notice → `ensureActivityIndicator()`. Match AC 5 (“in one turn”) so a later turn with the same command still gets a notice.
  2. **[gap]** **T3 CSS wrap must have an observable check.** happy-dom does not load `chat.css` (`test/plan-card.dom.test.ts` header; `test/chat-layout.dom.test.ts` / `test/chat-turn-containers.dom.test.ts` already use `ruleBlock`). T3’s verify list is only DOM. Add a source-text assertion that `.plan-notice span` contains `min-width: 0` and `overflow-wrap: anywhere` (and that `.plan-notice svg` stays `flex-shrink: 0`). Parent is `display: flex`; without `min-width: 0` the wrap rule is a no-op.
  3. **[gap]** **T2: freeze glob + keep snoop helper separate, with tests.** AC 7 says `<ws>/docs/plans/*.md` (one level) while T2/AC 6 use `**/*.md` (required for `.grokbit/plans/<slug>/01-intent.md`). Align AC 7 to recursive `**/*.md` for both trees. Disposition already says **COEXIST** with `isPlanFileWrite` — make that a test: workspace `.grokbit/plans/**/*.md` / `docs/plans/**/*.md` → `shouldBlockWrite` false **and** `isPlanFileWrite` still false (otherwise `acp.ts` snoops the write into the plan-review card). Also assert `.grokbit/handoff.md`, `.grokbit/hooks/**`, and `docs/plans/foo.ps1` stay blocked.
  4. **[gap]** **T3 DOM setup must unlock a real turn.** `ensureActivityIndicator` no-ops when `!busy || busyLocked || replaying`. Verify text says `setBusy true` — that does clear `busyLocked` when `locked` is omitted, but notices land via `appendOnTurnSurface` and Grokking via `activityParent()`. The busy+blocked case should `userMessage` or `agentStart` first, then `planBlocked`, and assert **both** `.plan-notice` and `.grokking` (or another live affordance). Keep idle+blocked → notice, no Grokking.
- Test/coverage gaps:
  - `test/plan-gate.test.ts`: screenshot `;` allow; `Test-Path a; Remove-Item b`; `{ }` still false; `Write-Output x | Out-File y` still false; `**/*.md` allow; `src/`, `.ps1`, `../` deny; `isPlanFileWrite` unchanged for workspace artifacts. Windows `\\?\` / relative `.grokbit/plans/…` would match existing `shouldBlockWrite` style.
  - `test/plan-card.dom.test.ts`: busy+block restores indicator; duplicate same `kind+target` → one notice; different targets → two; existing three-notice fixture stays valid if texts differ.
  - CSS wrap: source-text, not computed layout.
  - `test/acp-integration.test.ts` allow-write for `.grokbit/plans/…` is optional if unit tests cover `shouldBlockWrite` (acp only calls that helper).
  - Coverage: `npm run test:coverage` ≥ 80% changed lines, record ladder rung — as written, keep.
- Questions:
  1. For a wrapped multi-line command, should `.plan-notice` use `align-items: flex-start` so the icon stays top-aligned? Today it is `align-items: center`.
  2. Confirm carve-out is fs/`shouldBlockWrite` only (correct if grokbit-plan uses `fs/write_text_file`). Shell `Set-Content`/`Out-File` must stay blocked — already implied by T1 heads.
- Risk if implemented as-is:
  - Classifier + dead-frame fix can still ship, but duplicate blocks may keep destroying the live activity region; wrap CSS can be dropped with a green DOM suite; expanding `isPlanFileWrite` (against the disposition table) would dump grokbit-plan markdown into the plan-review card; a one-level `docs/plans/*.md` read of AC 7 would still allow this repo’s flat plans but is the wrong rule for nested grokbit-plan artifacts if copied.
  - Security of `;` staging and `..` escape is actually specified well — those tests are the backstop. Do not widen T1 to `{ }` / `iex` if live grok still hangs; file approach B as the plan already says.
- Next: **revise plan** (Required Changes 1–4 in `docs/plans/plan-mode-blocked-command-freeze.md`) → **re-review** (pass 2). Do **not** implement until Approve (user session “approve” does not satisfy this durable-file gate).
