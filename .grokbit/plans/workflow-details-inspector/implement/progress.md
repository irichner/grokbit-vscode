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
| T4a | done | 1 | `f21d093` | none | 70 tests in file; suite 1658 → 1673 |
| T4b | done | 1 | `pending` | none | glue only — suite unchanged at 1673 by design |
| T5 | done | 2 | `pending` | `test/workflow-detail.dom.test.ts` | 14 new tests; suite 1673 → 1687. Attempt 1 failed on my own test's row lookup, not on the code |
| T6 | done | 1 | `pending` | none | 16 new tests; suite 1687 → 1703 |
| T7 | **blocked** | 3 | — | none (reverted) | cap reached; see Blocked task detail |
| T8 | **blocked** | — | — | — | depends T7, which is blocked |
| T9 | done | 1 | `pending` | `resources/skills/grokbit-ship/references/how-it-works.md` | all six suite tiles now have a guide |
| T10 | **blocked** | — | — | — | depends T8, which is blocked behind T7 |

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

## Blocked task detail

### T7 — Per-agent edit brief + draft stash

Reverted at the Loop I2 cap. **The feature code was very likely correct** — 29 of
its 30 tests passed, including brief composition, Enter-to-draft, the empty-input
no-op, per-agent keying, and the seed-only guarantee. What never passed is the
one case T7's own `verify:` names explicitly: *draft-stash survives a `setBusy`
re-render and clears on Draft*. That is the task's central claim, so a pass
without it would have been a green tick over an unproven feature.

Attempt 1 — wrote `buildAgentEditBrief`, the edit box, the stash, CSS and 9 DOM
cases. 3 failed. Diagnosis from output: the brief was missing phase and prompt
excerpt, and the re-render test asserted against a freshly booted webview.

Attempt 2 — diagnosis: `buildWorkflowAgentBlock` passes the *view-model* agent,
which drops `phase`/`prompt`/`promptKind`, so `buildAgentEditBrief` could not see
them. Carried those three fields through `workflowDetailView`. 2 of 3 fixed; the
re-render case still failed (`expected '' to be 'half a thought'`).

Attempt 3 — diagnosis: the test booted a second webview, so it was reading an
empty stash from a different `state`. Rewrote it to re-render and re-open inside
the same harness. Now fails earlier: `TypeError: Cannot read properties of null
(reading 'querySelector')` at the re-opened row — after `setBusy true/false`,
clicking Details on the rebuilt row and dispatching the payload produced **no
`.workflow-agent` blocks**. Root cause not established within the cap. The two
live hypotheses, neither confirmed: (a) `state.pendingCapabilityDetail` still
points at the *detached* pre-re-render body, so the payload renders into an
orphaned node — which would be a real bug worth fixing rather than a test
artifact; (b) the rebuilt row's Details click toggles rather than opens, because
some expansion state survived the re-render.

Reverted (revert to clean): `git checkout --` on `media/chat.js`,
`media/webview-helpers.js`, `media/chat.css`, `test/workflow-detail.dom.test.ts`.
No files were created by this task, so nothing needed deleting. Suite re-verified
green at 1703 after the revert.

**Recommendation: re-plan T7, narrowly.** Hypothesis (a) is worth chasing first
because if it holds, it is a defect in shipped T6 code — a stale
`pendingCapabilityDetail` surviving a re-render — not merely a test problem, and
it would affect the suite-guide path too. Then split the task: make the stash's
key + restore a pure helper in `webview-helpers.js` (testable without any
re-render choreography), and keep one DOM case for the wiring. The current verify
asks a DOM test to prove a state-persistence property through three layers of
re-render mechanics, which is what made it brittle to write.

## Dependency verdicts
None — no task in this plan installs anything (blast radius: 0 new dependencies).
