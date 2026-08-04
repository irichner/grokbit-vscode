# Progress — workflow-details-inspector

The session's memory. Updated after every task.

`Created` is files this task added that did not exist before — distinct from
files it modified. Revert-to-clean deletes those; `git checkout` alone restores
only tracked files.

Commit policy for this session: **commit per task, no push** (user decision,
2026-08-03 — resolves the conflict between this skill's hard rule 2 and
CLAUDE.md's "no agent commits outside rebuild/release"). Baseline artifacts were
committed first as `5404b93`.

| Task | Status | Attempts | Commit | Created | Notes |
|---|---|---|---|---|---|
| T1 | done | 1 | `47a9e20` | `src/workflow-inspect.ts`, `test/workflow-inspect.test.ts` | 24 tests; suite 1603 → 1627 |
| T2 | done | 1 | `077acee` | `test/fixtures/workflows/review-changes.rhai`, `test/fixtures/workflows/spot-review-fanout.js` | 42 tests in file; suite 1627 → 1645 |
| T3 | done | 1 | `6ff6c13` | none | 55 tests in file; suite 1645 → 1658 |
| T4a | done | 1 | `pending` | none | 70 tests in file; suite 1658 → 1673 |
| T4b | pending | — | — | — | depends T4a |
| T5 | pending | — | — | — | independent |
| T6 | pending | — | — | — | depends T5 |
| T7 | pending | — | — | — | depends T6 |
| T8 | pending | — | — | — | depends T4b, T7 |
| T9 | pending | — | — | — | independent |
| T10 | pending | — | — | — | depends T8 |

Status: `pending` | `in-progress` | `done` | `blocked` | `skipped`

## Task notes

### T1 — Workflow call-site scanner (pure core)
Verify: `npx vitest run test/workflow-inspect.test.ts` (24 passed) · `npx tsc -p . --noEmit`
clean · `npm test` 79 files / 1627 passed. First attempt, no retries.

Implementation refinement worth recording (not a deviation — no plan claim was
contradicted): the design writes `parseAgentArgs(argsText, format): WorkflowAgentCall | null`,
but `index` and `inferredPhase` are both whole-file facts the argument text
cannot supply, so the function returns the exported alias
`ParsedAgentArgs = Omit<WorkflowAgentCall, "index" | "inferredPhase">` and T2's
assembler stamps the two. The semantic contract the design specified —
`null` means opaque — is unchanged.

`format` is accepted by both exported functions but currently unused: Rhai and JS
share string and comment syntax, and `optionsBlock` handles `#{` and `{` in one
path. Kept in the signature per the design so a future divergence has somewhere
to live; documented as such at both call sites rather than left as a puzzle.

Assumptions checked before starting: A5/A6 (agent-call shape rests on fixtures,
no real script exists on this machine) — still open, and unresolvable here since
resolving it needs a capture from a real CLI, not a code change. The test file
states this in its header so the next reader knows the fixtures are the spec.

## Dependency verdicts
None — no task in this plan installs anything (blast radius: 0 new dependencies).
