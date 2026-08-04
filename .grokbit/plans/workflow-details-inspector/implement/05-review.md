# Scope audit — workflow-details-inspector

One section per task, written after its verify passed and before its commit.
Every hunk is classified `IN_SCOPE`, `INCIDENTAL`, or `OUT_OF_SCOPE`.

## T1 — Workflow call-site scanner (pure core)

Declared files: `src/workflow-inspect.ts` (new), `src/capabilities.ts` (one-line
export), `test/workflow-inspect.test.ts` (new). Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `src/workflow-inspect.ts` — new module: types, `findCallSites`, `parseAgentArgs`, `AGENT_PROMPT_MAX_CHARS` | IN_SCOPE | Exactly the task's stated intent |
| `src/capabilities.ts` — `function extractMetaStringField` → `export function` | IN_SCOPE | The declared one-line export |
| `src/capabilities.ts` — two added doc-comment lines saying why it is exported | INCIDENTAL | Two lines inside the same declaration; matches the repo's convention of explaining why rather than what. Not reverted |
| `test/workflow-inspect.test.ts` — 24 cases | IN_SCOPE | The task's verify target |

Deletions: none — matches `removes: none`.
Files touched outside the declared set: none.
`AGENT_PROMPT_MAX_CHARS` is a new exported constant the design did not name
explicitly (it specified the ~2000-char cap in prose). Classified IN_SCOPE: it is
the cap the design called for, given a name so the test can assert against it
rather than hard-coding 2000 in two places.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**

## T2 — `parseWorkflowDetail` assembly + committed fixtures

Declared files: `src/workflow-inspect.ts`, `test/workflow-inspect.test.ts`,
`test/fixtures/workflows/review-changes.rhai` (new),
`test/fixtures/workflows/spot-review-fanout.js` (new). Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `WorkflowPhase`/`WorkflowDetail` types, `extractMetaPhases`, `parseWorkflowDetail`, `parsePhaseTitle` | IN_SCOPE | The task's stated intent |
| `WORKFLOW_DETAIL_MAX_BYTES`, `WORKFLOW_AGENT_CAP` constants | IN_SCOPE | Named by the task's own notes |
| `findMetaBlock` (module-private) | IN_SCOPE | `extractMetaPhases` takes a block; something had to produce it, and the design put no block-locator in `capabilities.ts`'s export list |
| Import of `parseRhaiWorkflowMeta`/`parseClaudeWorkflowMeta` | IN_SCOPE | Reuse over reimplementation — name/description keep exactly one implementation |
| Two fixture files | IN_SCOPE | Declared |
| 18 added test cases | IN_SCOPE | The verify target |

Deletions: none — matches `removes: none`.
Files touched outside the declared set: none.

**Duplication check (the reviewer's standing question).** `findMetaBlock` repeats
the *brace-locating* few lines of the two meta parsers. Considered and accepted
rather than passed over: the alternative is exporting a third helper from
`capabilities.ts`, which the design's changed-surfaces inventory deliberately
limited to `extractMetaStringField` and `rootEnabled`. The duplication is bounded
to finding the braces — every extracted *field* still has one implementation,
since `parseWorkflowDetail` calls the existing parsers for name and description
rather than re-extracting them. Recorded here so it is a decision, not an
accident.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**
