# Handoff — workflow-details-inspector

Input contract for `grokbit-test`. Session of 2026-08-03.

`hand_back_cycle: 0`

## Completed

| Task | Commit | What landed |
|---|---|---|
| — | `5404b93` | Baseline artifacts (pre-implementation) |
| T1 | `47a9e20` | Workflow call-site scanner (`src/workflow-inspect.ts`) |
| T2 | `077acee` | `parseWorkflowDetail` + committed fixtures |
| T3 | `6ff6c13` | `resolveWorkflowDetailPath` + `rootEnabled` export |
| T4a | `f21d093` | Injected-fs `workflowDetailRoots` / `readWorkflowDetail` |
| T4b | `b9e79a5` | Host wire: `detailKind`-routed `getCapabilityDetail` |
| T5 | `df37cc4` | Propagation boundary + request echo + kind-aware titles |
| T6 | `ce33dfe` | Workflow detail render + degraded states + CSS |
| T9 | `edb0e08` | `grokbit-ship` how-it-works guide |

Diff range for this session: `7d5e5a4..edb0e08`.

## Blocked

- **T7 — Per-agent edit brief + draft stash.** Reverted at the Loop I2 retry cap;
  no commit. Full three-attempt diagnosis in `progress.md` § Blocked task detail.
  The one case that never passed is the one T7's `verify:` names explicitly —
  *draft-stash survives a `setBusy` re-render*.
- **T8 — Host stamps.** Not attempted: `depends: T4b, T7`.
- **T10 — CLAUDE.md docs.** Not attempted: `depends: T8`.

## What this means for the feature's state

**The inspector is fully built but deliberately not switched on.** The host can
resolve, read, bound and parse a workflow, and the webview can render one — but
`capabilityFromWorkflowFile` still stamps no `hasDetail`/`detailPath`/`detailKind`
(that is T8), so no workflow tile shows a Details button and **a user sees no
change**. This is the plan's own dead-until-stamped ordering working as designed:
the tree is in a coherent, shippable-if-you-want state at every commit.

Done criteria 1–4 are *implemented but unreachable through the UI*; criterion 5
(edit by prompt) is not implemented; criterion 6 (suite tiles) is complete;
criterion 7 (the strategic recommendation) was always a design artifact.

## Files touched

`src/workflow-inspect.ts` (new), `src/capabilities.ts` (two exports + one stamp
site untouched), `src/sidebar.ts` (union, dispatch, handler + one new private
method), `media/chat.js`, `media/webview-helpers.js`, `media/chat.css`,
`resources/skills/grokbit-ship/references/how-it-works.md` (new),
`test/workflow-inspect.test.ts` (new), `test/workflow-detail.dom.test.ts` (new),
`test/webview-helpers.test.ts`, `test/fixtures/workflows/*` (new),
plus the baseline harness (`test/workflow-details.baseline.ts`,
`vitest.baseline.config.ts`, a `test:baseline` script).

## Dependencies added

**None.** Zero new packages, as the plan's blast radius stated.

## Dirty-tree snapshot

`snapshot: none`. The tree was dirty at preflight only with this pipeline's own
baseline artifacts, which were committed as `5404b93` rather than stashed — so
there is nothing outstanding to restore, and no `git stash` exists for this run.

## Deviations

1 counting (T7's block) of the 3 that would force a re-plan. Three non-counting
notes: the commit-policy decision, a PowerShell here-string/encoding mishap, and
foreign files appearing in the tree (below). See `deviations.md`.

## Things a test pass should look at hard

1. **A possible defect in already-committed T6 code.** T7's attempt-3 failure
   raises a hypothesis worth its own check: `state.pendingCapabilityDetail` holds
   a direct reference to a detail-body DOM node, and every capabilities re-render
   (`setBusy` fires on each transition) rebuilds those nodes. A reply arriving
   after a re-render would then render into a **detached** node — invisible, body
   stuck on "Loading…". If real, this affects the **shipped suite-guide path**
   too, not just workflows, and predates this change. It is unconfirmed; it is
   the single most valuable thing to reproduce.
2. **The five intended baseline flips.** `npm run test:baseline` currently shows
   21 tests, 5 failing, and every one was predicted in `test/baseline.md` §
   Expected movement: B1.4 / B1.5 (the propagation-boundary fix, T5) and B5.1 /
   B5.2 / B6.2 (the ship guide, T9). Each needs its `03-design.md` citation to be
   classified `INTENDED`; nothing else in that suite moved.
3. **B1.1 / B1.2 did *not* flip, and that is correct** — those baseline fixtures
   carry no `detailKind`, so they exercise the legacy request path, which T5
   deliberately preserved. Treat a flip there as a regression.
4. **B4.1 / B4.2 did not flip because T8 is blocked.** They will flip when it lands.
5. **Foreign files in the tree.** `.grokbit/context/`, `.grokbit/docs-manifest.json`,
   `docs/Grokbit-Features-and-Use-Cases.docx`, `docs/features-and-use-cases.md`,
   `scripts/_finalize_features_doc.py`, `scripts/_gen_features_use_cases_docx.py`
   appeared mid-session from something outside this pipeline. Verified against
   `git log --name-only` that no commit here swept them in; they remain untracked
   and untouched. They are **not** this session's output and should not be
   attributed to it.

## Verify mode deliberately not auto-invoked

Recorded as a judgment, not an omission. With T8 blocked the feature is not
reachable from the UI, so a verify pass could only report what this file already
states — done criteria 2 and 5 unmet, verdict `DO NOT SHIP` — at the cost of a
full expensive-tier roster. The useful next action is resolving T7's blocker (or
confirming hypothesis 1 above), after which T8, T10 and a genuine verify pass all
become worthwhile in one go.

Suite state at handoff: **80 files / 1703 tests green**, `npx tsc -p . --noEmit`
clean, at `edb0e08`.
