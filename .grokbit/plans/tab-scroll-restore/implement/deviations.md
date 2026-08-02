# Deviations — tab-scroll-restore

Where reality contradicted the plan. **At 3, stop and re-plan.**

## Waivers — recorded here, never counted

- Dirty tree — 2026-08-01 — user invoked `/grokbit-implement this plan` on a multi-file WIP workspace. Full `git stash -u` would risk unrelated work. Proceeded dirty without stashing; task-scoped edits only.
- Commit-per-task deferred — 2026-08-01 — project `CLAUDE.md` / AGENTS: never commit automatically. Implement skill's commit-per-task suspended; user can commit when ready. Revert-to-clean still possible via file checkout of task paths.
- Baseline — existing `test/baseline.md` is for chat-turn-containers; scroll baseline characterized in preflight (suite green + known always-pin-on-reveal). No separate grokbit-test baseline mode run; suite preflight substitutes for grok-free suite baseline.

## D1 — T3/T5 — undeclared test files for scrollState ambient posts
Plan expected: only `test/tab-scroll-restore.dom.test.ts` for webview scroll tests
Actually found: `forceScrollToBottom` posts `scrollState`, which broke exact `posted` equality in `test/question-card.dom.test.ts` and `test/plan-history-restore.dom.test.ts`
Impact: suite red until those tests ignore ambient scrollState posts
Resolution: filtered `scrollState` from assertions in those two files (INCIDENTAL test update; no product behavior change)

---

Count: 1 of 3
