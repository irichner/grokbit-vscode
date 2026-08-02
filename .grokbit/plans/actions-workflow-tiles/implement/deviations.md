# Deviations — actions-workflow-tiles

Where reality contradicted the plan. **At 3, stop and re-plan.**

## Waivers — recorded here, never counted

Not numbered `D<n>`, not included in the Count line below.

- Dirty-tree clean — 2026-08-01 — user asked to clean the tree; prior WIP stashed as `pre-implement clean for actions-workflow-tiles` (tracked files only). Recover with `git stash pop` after this work if needed.
- Formal `test/baseline.md` — 2026-08-01 — plan T2–T5 baselines are descriptive UI snapshots in `plan.md`, not grokbit-test baseline artifacts. Preflight suite green (1338) used as executable floor. Not a plan contradiction.

## D1 — T6 — undeclared file required for green suite

Plan expected: T4/T6 verify only touch declared files (`media/chat.css`,
`test/capabilities.dom.test.ts`, `CLAUDE.md`, `CHANGELOG.md`)
Actually found: `test/chat-layout.dom.test.ts` hardcodes the old
`minmax(min(100%, 260px), 1fr)` string and an `@media` token count of 2; T4's
300px track broke the suite gate at T6.
Impact: full-suite verify red without a one-line assertion update in an
undeclared file.
Resolution: update the layout source check to 300px (and keep `@media` count
at 2 by avoiding the token in comments). Recorded as deviation; not a plan
rewrite of T4's files list.

## Count

Count: 1 of 3
