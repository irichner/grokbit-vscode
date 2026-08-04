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

**T2 duplication check (the reviewer's standing question).** `findMetaBlock` repeats
the *brace-locating* few lines of the two meta parsers. Considered and accepted
rather than passed over: the alternative is exporting a third helper from
`capabilities.ts`, which the design's changed-surfaces inventory deliberately
limited to `extractMetaStringField` and `rootEnabled`. The duplication is bounded
to finding the braces — every extracted *field* still has one implementation,
since `parseWorkflowDetail` calls the existing parsers for name and description
rather than re-extracting them. Recorded here so it is a decision, not an
accident.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**

## T3 — `resolveWorkflowDetailPath` + `rootEnabled` export

Declared files: `src/workflow-inspect.ts`, `src/capabilities.ts` (one-line
export), `test/workflow-inspect.test.ts`. Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `resolveWorkflowDetailPath`, `formatForPath`, `WorkflowPathError`/`ResolvedWorkflowPath` types | IN_SCOPE | The task's stated intent |
| `src/capabilities.ts` — `rootEnabled` gains `export` + a doc comment | IN_SCOPE | The declared one-line export; comment states why, per repo convention |
| Import of `isPathContained` into `workflow-inspect.ts` | IN_SCOPE | Reuse of the scan's own containment predicate, exactly as the design specified |
| 13 added test cases incl. symlink escape, empty-root fail-closed, ENOENT mapping | IN_SCOPE | The verify target |

Deletions: none. Files touched outside the declared set: none.

**One deliberate hardening beyond the letter of the design.** The design says
"extension check as in the scan", and the scan checks the *directory entry name*.
This resolver checks the extension on the **resolved** path and derives `format`
from it, so a `.rhai` symlink aimed at a `.js` file (both inside an allowed root,
so containment alone would pass) cannot get the wrong parser pointed at it. The
requested path's extension is still checked first, before any I/O, so a junk
request costs nothing. Classified IN_SCOPE — it is the same check, applied where
it is load-bearing — and recorded because it is stricter than what was written.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**

## T4a — Injected-fs workflow-detail read helper

Declared files: `src/workflow-inspect.ts`, `test/workflow-inspect.test.ts`.
Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `WorkflowInspectFsLike` port, `workflowDetailRoots`, `readWorkflowDetail`, result types | IN_SCOPE | The task's stated intent |
| `node:path` + `CapabilityRootSpec`/`rootEnabled` imports | IN_SCOPE | Required by root computation; `node:path` is a pure import, consistent with `capabilities.ts` |
| 15 added test cases (root filtering, env switch, symlink escape, dedupe, cap/truncation, every error mapping) | IN_SCOPE | Exactly the list the task's verify enumerates |

Deletions: none. Files touched outside the declared set: none.

**Deliberate divergence from the suite branch, recorded.** An over-cap workflow
is read to the cap and parsed with `truncated: true`, where the suite-guide
branch refuses an over-cap guide with `"too-large"`. This is the design's Axis A3
choice, not an oversight: half an agent list plus an honest "this file was
longer" line is useful; half a prose document cut mid-sentence is not.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.** *(T4a)*

## T4b — Host wire: `detailKind`-routed `getCapabilityDetail`

Declared files: `src/sidebar.ts` (union member, dispatch, handler). Declared
`removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| Union member gains `detailKind?`/`path?` | IN_SCOPE | Declared |
| Dispatch extracts both new fields, string-typed or dropped | IN_SCOPE | Declared |
| `getCapabilityDetail` signature + `detailKind === "workflow"` early return | IN_SCOPE | Declared |
| New private `postWorkflowDetail` | IN_SCOPE | The branch body; kept a separate method so the suite arm below it is visibly untouched |
| Import of the three `workflow-inspect` symbols | IN_SCOPE | Required |

Deletions: none. Files touched outside the declared set: none.
**Suite arm verified byte-for-byte unchanged** — the diff adds an early return
above `resolveSuiteHowItWorksPath` and appends a method after it; not one line of
the existing guide flow was edited.

`postWorkflowDetail` builds its `fs` port from the existing `capabilityFs()`
adapter rather than writing a second `openSync`/`readSync`/`closeSync` block, so
the bounded positional read still has exactly one implementation in the repo.

**No new tests, and that is the task's own stated position**, not an omission:
every decision in this branch is unit-tested in T4a, and the round trip is
asserted by T5/T8's DOM tests. What is left here is input gathering and a
`postTo`, the same thin-glue status the shipped suite handler has always had.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.** *(T4b)*

## T5 — Propagation boundary + request echo + detail-kind titles

Declared files: `media/chat.js` (the `:857-909` region), `media/webview-helpers.js`
(`capabilityGroupsView`), `test/workflow-detail.dom.test.ts` (new),
`test/webview-helpers.test.ts`. Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `detailWrap` click boundary + `isWorkflowDetail` local | IN_SCOPE | The Round-1 BLOCKER fix |
| Both button `title`s made detail-kind-aware | IN_SCOPE | Declared in the changed-surfaces inventory |
| Request echo built as an object, omitting absent fields | IN_SCOPE | Declared; omitting rather than sending `undefined` keeps the wire shape exact and the assertions honest |
| `capabilityGroupsView` forwards a validated `detailKind` | IN_SCOPE | Declared |
| 12 DOM cases + 2 helper cases | IN_SCOPE | The verify targets |

Deletions: none. Files touched outside the declared set: none.

**The two existing per-button `stopPropagation` calls were deliberately left in
place.** The wrap boundary makes them redundant, and removing dead code is
exactly the opportunistic tidying the scope rule forbids — they are also a
sensible belt-and-braces for anyone who later moves a button out of the wrap.

**Declared behavior change, now covered by a test.** The boundary also changes a
*shipped* suite row: clicking the rendered guide body no longer seeds
`/grokbit-explore` and closes the popover. That is the latent
read-the-guide-lose-your-composer bug, and `03-design.md` § UI structure declares
the fix rather than claiming the suite path is byte-identical. The baseline
records the old behavior (B1.4/B1.5), so verify will classify it INTENDED
against that citation.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**

## T6 — Workflow detail render + degraded states + CSS

Declared files: `media/webview-helpers.js`, `media/chat.js` (handler region),
`media/chat.css`, `test/webview-helpers.test.ts`, `test/workflow-detail.dom.test.ts`.
Declared `removes: none`.

| Hunk | Classification | Note |
|---|---|---|
| `workflowDetailView` + `plural` + export | IN_SCOPE | Declared |
| `renderWorkflowDetail`, `buildWorkflowAgentBlock`, `capabilityDetailErrorText` | IN_SCOPE | The declared render, kept out of the message handler so the handler stays a router |
| `capabilityDetail` handler: payload branch, `.workflow-detail` class, error routing | IN_SCOPE | Declared |
| `pendingCapabilityDetail` gains `detailKind` (outside the cited line region, same declared file) | INCIDENTAL | Necessary, not incidental to intent: both host branches reply `{name, error}`, so nothing else can tell whether "couldn't read it" should say *guide* or *workflow script*. Kept because the alternative is wrong copy on every workflow error |
| `.workflow-*` CSS + `.workflow-detail` max-height | IN_SCOPE | Declared |
| 16 tests (6 pure, 10 DOM) | IN_SCOPE | The verify targets |

Deletions: none. Files touched outside the declared set: none.

CSS conforms to the standing rules: VS Code tokens only, no `@media`, no `vh`,
fixed-px bounds (`test/chat-layout.dom.test.ts` re-run and green). The prompt
`<pre>` is bounded and scrolls rather than stretching the body.

**Security posture held:** every string from the parsed script reaches the DOM
through `textContent`, never `innerHTML` — asserted directly with a prompt
containing `<script>` and an `onerror` image.

**Verdict: no OUT_OF_SCOPE hunks. Commit approved.**
