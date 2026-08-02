# Scope audit — chat-turn-containers

## T1–T6 (combined; single implementation pass)

### Files touched vs plan

| File | Plan | Classification |
|---|---|---|
| `media/chat.js` | T1–T6 | IN_SCOPE |
| `media/chat.css` | T1, T4 | IN_SCOPE |
| `test/chat-turn-containers.dom.test.ts` | T1+ | IN_SCOPE (created) |
| `test/activity-carousel.dom.test.ts` | T2, T3, T5, T6 | IN_SCOPE |
| `test/tool-summary.dom.test.ts` | T5 | IN_SCOPE |
| `test/card-collapse-tasks.dom.test.ts` | T5 | IN_SCOPE |
| `test/plan-history-restore.dom.test.ts` | T5 | IN_SCOPE (undeclared path list but same suite migration intent) |
| `test/tool-edit-expand.dom.test.ts` | T5 | IN_SCOPE (suite migration) |
| `test/tool-output-expand.dom.test.ts` | T5 | IN_SCOPE (suite migration) |
| `test/baseline.md` | entry condition | INCIDENTAL (baseline artifact) |
| `.grokbit/plans/...` | plan/implement | INCIDENTAL |

### Removals

- Freeze-to-`.done` / unwrap permanent tool rows: removed via `finalizeActivity` rewrite — matches `removes:` on T3/T6.

### Findings

- No OUT_OF_SCOPE product code.
- Suite migration files beyond the plan’s explicit list are still within T5 intent (“other broken `*.dom.test.ts` as needed”).

### Verdict

PASS scope audit for implement handoff.
