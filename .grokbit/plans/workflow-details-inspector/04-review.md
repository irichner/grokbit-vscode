# Review — Workflow details inspector

## Round 1

Reviewed against `01-intent.md`, `02-survey.md`, `03-design.md`. Ten citation spot-checks were
performed by opening the cited files at the cited lines this session:

- `src/sidebar.ts:3505-3532` (`getCapabilityDetail` handler) — matches the design's description, including the `"too-large"` refusal at `:3518-3520` the truncation story contrasts against. ✓
- `src/skill-suite.ts:227-235` (`resolveSuiteHowItWorksPath` name allowlist), `:207-220` (`attachSuiteHowItWorks` existence-driven stamp), `:168` (`HOW_IT_WORKS_MAX_BYTES = 64*1024`) — all as claimed. ✓
- `media/chat.js:857-909` (detail branch: `hasDetail` gate at `:860`, pending stash at `:881-888`, locked-disabled at `:891-893`, Open-in-editor at `:895-905`) — as claimed. ✓
- `src/capabilities.ts:568-585` (`capabilityFromWorkflowFile` — sets no `hasDetail`/`detailPath` today), `:499-544` (`parseClaudeWorkflowMeta` `inStr`/`escape` scanner), `:448-462` (`extractMetaStringField`, confirmed module-private as the design states), `:136-173` (`CAPABILITY_ROOTS` workflow roots), `:805-818` (`.rhai`/`.js` exact-extension filter), `:182`/`:839` (8KB head read) — all as claimed. ✓
- `src/capabilities.ts:719-723` — `isPathContained` **is exported** (`export function`), resolving the design's Assumption 3 in the good direction (no churn needed). ✓
- `media/webview-helpers.js:1069-1116` (`buildWorkflowCraftBrief`) and `:1118-1180` (`capabilityGroupsView`) — as claimed. ✓
- `media/chat.css:2393-2406` (`.capability-row-detail-body`, `max-height: 220px`) — as claimed. ✓
- `src/panel-router.ts:83-85` (`postTo` dropped-when-not-ready contract) — as claimed; the design keeps `capabilityDetail` on `postTo`, so no replay-buffer hazard is introduced. ✓
- `media/chat.js:6096-6119` (`capabilityDetail` webview handler) and `:919-926` (invoke rows use replace-mode seeding) — as claimed, but see BLOCKER 1 and MINOR 1 for what these two sites reveal that the design missed. ✓

Intent coverage: all 7 done criteria are addressed (criterion 7's strategic question gets a
concrete, non-hedged answer — inspector first, phased read-only-run-visibility next gated on a
research probe, explicit not-recommended list). No non-goal is violated (Axis D's new
`grokbit-ship` guide is extension-authored bundle content serving criterion 6, not user editing of
suite skills; no new settings; no execution UI; no transpile; no graph editor). All four survey
Supersession rows carry explicit dispositions with reasons, plus two new rows. The one REPLACE
(`grokbit-ship` no-details state) has no callers to decommission. Blast radius: the design names
the two large files, the layout guard test, the four-anchor lifecycle, and the measured 1603-test
floor. Unhappy paths (b), (e), (h), (i), (j) check out as designed — (b) truncated-parse beats the
suite path's refusal and says so; (e) `promptKind: "dynamic"`; (h) `detailBtn.disabled` while
locked is real code; (i) the brief's index+phase+excerpt disambiguation is explicitly stated; (j)
capabilities payloads are per-session/per-backend and the brief's Format line covers the
stale-composer-across-backend-flip residue.

### Findings

- `[BLOCKER]` Every interactive element the design adds inside the workflow detail body will fire the row's own invoke click-through, because workflow rows are invocable and the design never specifies event propagation — evidence: workflow items carry `invoke` (`src/capabilities.ts:580`), so `capabilityGroupsView` gives them `action: "invoke"` (`media/webview-helpers.js:1129-1131`) and `buildCapabilityRow` installs `row.onclick = … insertComposerPrompt(item.invoke, {mode:"replace"}); closePopovers();` (`media/chat.js:919-926`). The detail body is appended *inside* that row (`media/chat.js:907-908`), and the shipped mechanism only survives because its two buttons each call `e.stopPropagation()` (`media/chat.js:872-873`, `:901-902`). The design's UI section adds per-agent summary `<button>`s, an edit `<input>`, and a Draft button with no propagation handling — so clicking to focus the edit box, or expanding an agent, bubbles to `row.onclick`, clobbers the composer with `/workflow <name> ` and closes the popover mid-flow. Done criteria 2 and 5 fail as written — what would resolve it: specify a `stopPropagation` boundary on the detail wrap/body (or on each interactive child), and add a DOM test asserting a click inside the open body neither seeds the invoke nor closes the popover.
- `[MAJOR]` The request-routing discriminant is self-contradictory: suite items DO have `path`, so "populated only when the item has a `path`" and "suite tiles keep sending name-only" cannot both be true — evidence: suite items are scanned skill files, so `capabilityFromSkillFile` gives them `path` (their `SKILL.md`), and `capabilityGroupsView` passes `path` through to the row model (`media/webview-helpers.js:1127`, `:1149`); `applySuiteKind`/`attachSuiteHowItWorks` re-key and stamp but never strip it (`src/skill-suite.ts:148-165`, `:207-220`). Implemented per the letter of design step 2 ("one new optional field … populated only when the item has a `path`"), every suite Details click sends its `SKILL.md` path, the host routes it into the workflow branch, containment against the workflow roots fails, and the shipped suite Details regress to `"not-a-workflow-path"`. The natural fixes each conflict with a stated rule (branching on `kind === "workflow"` in the webview violates the never-branch-on-kind rule the design itself cites at `media/chat.js:805-807`) — what would resolve it: define the discriminant explicitly, e.g. a host-stamped field on workflow items (`detailKind: "workflow"` or `detailFormat`) that the webview echoes, mirroring how `control === "switch"` already encodes row shape without kind strings; plus a suite-regression DOM test asserting the name-only request survives.
- `[MINOR]` Grounding error in the message table: "dispatch `:3254-3255` passes the whole msg" is false — evidence: `src/sidebar.ts:3254-3255` extracts only the name (`this.getCapabilityDetail(session, typeof msg.name === "string" ? msg.name : "")`), and the private method's signature is `(session, name: string)` (`src/sidebar.ts:3505`). Both must change to carry `path`; the design's text implies they don't — what would resolve it: correct the claim and list the dispatch + signature change in the changed-surfaces inventory.
- `[MINOR]` `truncated` is specified contradictorily: it is a field of `WorkflowDetail` returned by the pure `parseWorkflowDetail(text, format)`, but truncation is a read-time fact the parser cannot observe from the already-sliced text, and the wire envelope *also* carries a top-level `truncated?` — evidence: design § New pure functions (interface `WorkflowDetail { … truncated: boolean }`) vs. data-flow step 3 (`postTo(session, { …, workflow, path, truncated })`) — what would resolve it: pick one owner (host passes a `truncated` input into the parser, or the flag lives only on the wire envelope and is dropped from `WorkflowDetail`).
- `[MINOR]` The zero-agents degraded line is dishonest for a legitimately agent-free script: a workflow built of pure `pipeline()` lambdas (unhappy path (d)) parses to `agents: []` with `opaqueAgentCalls: 0`, yet renders "Couldn't read the agent list from this script" — a false statement in the feature whose whole Axis A3 pitch is honesty, and the data model already distinguishes the two cases (zero `agent(` sites found vs. sites found but opaque). Relatedly, a file deleted between scan and click (path (a)) fails realpath and surfaces as `"not-a-workflow-path"` — a mislabel for ENOENT — what would resolve it: branch the empty-state wording on `opaqueAgentCalls`/site count ("No agent calls in this script" vs. "Couldn't read the agent list"), and route resolver ENOENT to `"read-failed"`.
- `[MINOR]` `WORKFLOW_AGENT_CAP` overflow is folded into `opaqueAgentCalls` ("render + parse ceiling; +N-more via opaque count"), so perfectly-readable calls past #40 render under "+N agent call(s) couldn't be read" — the same honesty defect as above, in the other direction — what would resolve it: a separate overflow count (or footer wording that covers both truthfully, e.g. "+N more not shown").
- `[MINOR]` Suite-specific UI copy and doc comments go stale on workflow rows and are unaddressed: `detailBtn.title = "How this workflow works (roles, loops, caps)"` (`media/chat.js:867`) and Open-in-editor's `"Open the full how-it-works guide as a file"` (`media/chat.js:900`) will render on rows whose target is a script, not a guide; `CapabilityItem.detailPath`'s doc says "Absolute path to `references/how-it-works.md`" and `hasDetail`'s says set by `attachSuiteHowItWorks` "never invented for arbitrary skills" (`src/capabilities.ts:64-71`), both falsified by the new workflow stamp — what would resolve it: enumerate these copy/doc updates in the design's changed-surfaces list.
- `[MINOR]` Typed-but-undrafted edit instructions are silently destroyed by any panel/popover re-render and the design never acknowledges it: the edit `<input>` lives inside a body rebuilt from scratch on `setBusy` (every transition), `modeChanged`, `backendChanged`, a capabilities refresh, or a `commandsUpdate` re-post — the design accepts collapse-on-re-render for *expansion state* ("accepted, not fought") but the same event also eats user-typed text, a materially worse loss — what would resolve it: state it as an accepted limitation explicitly, or stash the draft text in `state` keyed by path+agent index the way `state.capabilitiesExpanded` survives re-renders.
- `[MINOR]` `resolveWorkflowDetailPath`'s spec is looser than the scan it claims to mirror: (a) it realpaths the *requested* path but doesn't say the `allowedRoots` side is realpath'd (the scan realpaths both base and dir and rejects symlinked roots, `src/capabilities.ts:762-773`; an unresolved root here fails closed — safe, but the "mirrors `isPathContained`" claim oversells); (b) which backend's root set is used is left to UNVERIFIED Assumption 4 — the pure signature takes `allowedRoots` but nothing decides session-backend-only vs. the union of both; (c) a root disabled by `disabledByEnv` (`GROK_WORKFLOWS`, `src/capabilities.ts:147-148`) is invisible to the scan but would still be servable by the detail read — what would resolve it: one paragraph pinning all three (roots are realpath'd host-side before injection; session-backend root set; `rootEnabled` honored), plus the corresponding containment test cases.

Round 1 verdict: 1 BLOCKER / 1 MAJOR / 7 MINOR

## Round 1 — Architect response

All nine findings addressed; `03-design.md` revised in place (it reads as the current design, not
a patch log). Evidence re-confirmed this session by opening `media/chat.js:804-931`,
`media/webview-helpers.js:1118-1180`, `src/skill-suite.ts:140-235`, `src/capabilities.ts:40-190`,
`:560-620`, `:715-824`, and `src/sidebar.ts:3240-3265`, `:3419-3532`.

- **BLOCKER 1 (event propagation) — REVISED.** New "Event-propagation contract" subsection in
  § UI structure: one boundary listener on `.capability-row-detail-wrap`
  (`addEventListener("click", e => e.stopPropagation())`) absorbs every click inside the wrap —
  buttons, the edit input, selectable prompt text, and bare padding — so nothing reaches
  `row.onclick` (`media/chat.js:919-926`) or the document-level `closePopovers()`; the shipped
  per-button guards (`media/chat.js:872-873`, `:901-902`, confirmed by opening the file) stay as
  redundant belt-and-braces. The row head *outside* the wrap keeps its invoke-on-click even while
  the body is open (matches today's suite-row behavior; stated as deliberate). Keyboard contract
  pinned: natural DOM tab order, Enter/Space on summary buttons toggles (synthesized clicks bubble
  through the same boundary), Enter in the edit input triggers Draft, Escape keeps popover-close
  with typed text surviving via the draft stash. The blocker-guard DOM test (click inside open
  body → composer unchanged + popover open; row-head click → invoke still fires) is added to the
  testing strategy.
- **MAJOR 2 (discriminant) — REVISED.** Confirmed the review's evidence: suite items keep `path`
  through both `applySuiteKind` and `attachSuiteHowItWorks` (spread-copies,
  `src/skill-suite.ts:156-163`, `:212-218`) and `capabilityGroupsView` forwards it
  (`media/webview-helpers.js:1127`, `:1149`) — path presence is unusable. Chose the host-stamped
  field over echoing `kind`: `CapabilityItem.detailKind?: "guide" | "workflow"`, stamped by
  `attachSuiteHowItWorks` (`"guide"`) and `capabilityFromWorkflowFile` (`"workflow"`, which today
  stamps neither detail field — verified), passed through `capabilityGroupsView`, echoed by the
  webview, routed on by the host with absent/unknown falling back to the suite branch
  byte-for-byte (which ignores `path` entirely). Justified against the `kind` alternative:
  `detailKind` names the actual variable (which detail flavor the host stamped), avoids the
  renderer's never-branch-on-kind rule, and mirrors the shipped `control === "switch"`
  shape-field precedent. Echo is a routing hint, never authorization — each branch is
  independently safe. Suite-regression DOM test (`detailKind:"guide"`, no `path`, markdown render
  unchanged) added.
- **MINOR 3 (false dispatch citation) — REVISED.** Corrected: the dispatch extracts only `msg.name`
  (`src/sidebar.ts:3254-3255`, re-verified) and the handler signature is `(session, name)`. Both
  changes (dispatch extraction of `detailKind`/`path`, widened signature) are now stated in
  data-flow step 2 and listed in a new "Changed-surfaces inventory".
- **MINOR 4 (`truncated` owner) — REVISED.** Single owner: the host observes
  `st.size > WORKFLOW_DETAIL_MAX_BYTES` at read time and passes it into
  `parseWorkflowDetail(text, format, { truncated })`; the flag lives only on
  `WorkflowDetail.truncated`. The wire envelope's top-level `truncated` is deleted from the
  message table and data-flow step 3.
- **MINOR 5 (zero-agents honesty + ENOENT) — REVISED.** `WorkflowDetail` gains
  `agentCallSites: number`; the empty state branches on it — `0` sites → "No agent calls found in
  this script — it may build its steps dynamically…", `>0` sites with `agents: []` → "Couldn't
  read the agent list…". `resolveWorkflowDetailPath`'s return type gains `"read-failed"`, and
  realpath ENOENT (file deleted between scan and click) maps to it, not
  `"not-a-workflow-path"`; the error table and parser/resolver test lists carry both cases.
- **MINOR 6 (cap-overflow honesty) — REVISED.** Sites past `WORKFLOW_AGENT_CAP` are unexamined,
  not damaged: they accumulate in a new `overflowAgentCalls` count with their own footer line
  ("+N more agent call(s) not shown"), never folded into `opaqueAgentCalls`; tests assert the two
  counts and footers stay distinct.
- **MINOR 7 (stale suite copy/doc comments) — REVISED.** The changed-surfaces inventory now
  enumerates: `media/chat.js:867` detail-button title and `:900` Open-in-editor title become
  detail-kind-aware (workflow: "What this workflow runs (agents, phases, prompts)" / "Open the
  workflow script in the editor"); the `CapabilityItem.hasDetail`/`detailPath` doc comments at
  `src/capabilities.ts:64-71` are rewritten to name both stampers and describe `detailPath` per
  `detailKind`. Detail-kind-aware titles are in the DOM test list.
- **MINOR 8 (typed-draft loss) — REVISED** (stash, not accept-and-document). New "Draft-text
  persistence" subsection: an `input` listener writes to
  `state.workflowAgentDrafts[detailPath + "#" + agent.index]` (the `state.capabilitiesExpanded`
  survival idiom), the render restores it, cleared on successful Draft and in
  `resetForNewSession`. Expansion state remains deliberately DOM-local; only the typed text is
  preserved. Draft-stash survival across a `setBusy` re-render is a named DOM test.
- **MINOR 9 (`resolveWorkflowDetailPath` looseness) — REVISED.** A pinned four-point spec in
  § New pure functions: (a) roots are realpath'd host-side with the scan's own
  base-contains-root check (`src/capabilities.ts:762-773`) and dropped on failure — fail closed —
  so the "mirrors the scan" claim is now stated per-divergence rather than oversold; (b) root
  set = `CAPABILITY_ROOTS[session.backend]` workflow roots only, recomputed at the handler from
  the same inputs `listCapabilities` derives per call (resolving former Assumption 4); (c)
  `rootEnabled` honored, so an env-disabled root (`GROK_WORKFLOWS`) is not servable by the detail
  read; (d) exact-extension check per the scan. Containment test cases extended accordingly. Also
  folded in the review's spot-check that `isPathContained` is exported (former Assumption 3 →
  RESOLVED).

## Round 2

Re-reviewed the revised `03-design.md` in full against the Round 1 findings and re-opened the
files the revisions lean on: `src/skill-suite.ts:140-165` (`applySuiteKind`'s map spread-copies
the item and never strips `path` — the `detailKind` rationale's evidence is accurate; `:212-218`
`attachSuiteHowItWorks` likewise, confirmed Round 1), `media/chat.js:804-931` (wrap creation
`:861-862`, wrap appended inside the invocable row `:907-908`, per-button `stopPropagation`
`:872-873`/`:901-902`, `row.onclick` invoke `:919-926` — the propagation-boundary contract is
grounded), `media/webview-helpers.js:1118-1180` (`capabilityGroupsView` pass-through claims
accurate; `detailKind` correctly listed as a new change), `src/sidebar.ts:3419-3441`
(`sessionCwd` + `HOME || USERPROFILE || os.homedir()` + `CAPABILITY_ROOTS[session.backend]` —
the Assumption-4 resolution's "recompute per call from the same inputs" claim is accurate), and
`src/capabilities.ts:694` (`rootEnabled` — see new finding below).

### Round 1 findings — status

- BLOCKER 1 (event propagation) — **RESOLVED.** Single boundary listener on
  `.capability-row-detail-wrap`, row head deliberately keeps invoke, keyboard contract pinned
  (synthesized clicks bubble through the same boundary), blocker-guard DOM test in both
  directions. One residual inaccuracy in its prose → new MINOR 3 below.
- MAJOR 2 (routing discriminant) — **RESOLVED.** Host-stamped `detailKind: "guide" | "workflow"`,
  echoed as a routing hint with absent/unknown falling back to the suite branch byte-for-byte;
  the suite branch ignores `path`; each branch independently safe; suite-regression DOM test
  added. The spread-copy evidence (`src/skill-suite.ts:156-163`, `:212-218`) checks out, and the
  `control === "switch"` precedent argument is consistent with the renderer rule at
  `media/chat.js:805-808`.
- MINOR 3 (dispatch grounding) — **RESOLVED.** Corrected in data-flow step 2, the message table,
  and the new changed-surfaces inventory (dispatch extraction + widened signature both listed).
- MINOR 4 (`truncated` owner) — **RESOLVED.** Host observes it, passes it into
  `parseWorkflowDetail(text, format, { truncated })`; envelope field deleted; message table,
  interface comment, and parser test all agree.
- MINOR 5 (zero-agents honesty + ENOENT) — **RESOLVED.** `agentCallSites` added; two distinct
  sentences branched on it; resolver return type gains `"read-failed"`; ENOENT mapped to it with
  the rationale stated; error table and test lists carry both cases.
- MINOR 6 (cap-overflow honesty) — **RESOLVED** in substance (`overflowAgentCalls`, separate
  footer, tests assert the counts stay distinct) — but the revision left a contradicting stale
  comment in its own spec block → new MINOR 2 below.
- MINOR 7 (stale suite copy/doc comments) — **RESOLVED.** Changed-surfaces inventory enumerates
  `media/chat.js:867`/`:900` detail-kind-aware titles and the `src/capabilities.ts:64-71` doc
  rewrites; detail-kind-aware titles are in the DOM test list.
- MINOR 8 (typed-draft loss) — **RESOLVED.** `state.workflowAgentDrafts` stash keyed
  `detailPath + "#" + agent.index`, restored on render, cleared on Draft and
  `resetForNewSession`; draft-stash survival across a `setBusy` re-render is a named DOM test.
- MINOR 9 (resolver spec looseness) — **RESOLVED** on all three sub-points (roots realpath'd
  host-side/fail closed; session-backend roots recomputed per call — verified against
  `src/sidebar.ts:3419-3441`; `rootEnabled` honored) — but the `rootEnabled` dependency the fix
  introduces needs an export the design doesn't note → new MINOR 1 below.

### Findings (open now)

- `[MINOR]` `rootEnabled` is module-private, and the design's own "Changed in
  `src/capabilities.ts`" line is stale against its revisions — evidence: the pinned resolver spec
  has the host filter roots via `rootEnabled(r, process.env)` from `sidebar.ts`, but `rootEnabled`
  is an unexported `function` (`src/capabilities.ts:694`) — the exact situation the design
  carefully flags for `extractMetaStringField` (`03-design.md` § New pure functions; Assumption 3)
  but omits here; and the summary line "**Changed in `src/capabilities.ts`:**
  `capabilityFromWorkflowFile` stamps `hasDetail`/`detailPath`; `extractMetaStringField` exported"
  (`03-design.md:388-389`) omits both the `detailKind` stamp (stated in data-flow step 1 and the
  changed-surfaces inventory) and the `rootEnabled` export — what would resolve it: add
  `rootEnabled` export to the spec and bring the "Changed in" line in step with the inventory
  (`… stamps hasDetail/detailPath/detailKind; extractMetaStringField and rootEnabled exported`).
- `[MINOR]` Stale spec-block comment contradicts the revised overflow accounting — evidence:
  `WORKFLOW_AGENT_CAP = 40 // render + parse ceiling; +N-more via opaque count`
  (`03-design.md:312`) survives from the pre-revision text, while the truncation story
  (`:80-84`), the `overflowAgentCalls` field comment ("unexamined, never 'opaque'", `:329`), and
  the error table (`:552`) all now say overflow is its own count, never folded into opaque — an
  implementer skimming the spec block gets the superseded rule — what would resolve it: update
  the comment (e.g. `// parse ceiling; overflow → overflowAgentCalls, never opaque`).
- `[MINOR]` "Keeps the suite path byte-identical" overstates — the wrap boundary changes
  observable shipped suite-row behavior, beneficially but undeclared — evidence: today a click on
  a suite guide's rendered body text or the wrap's padding (anywhere but the two guarded buttons,
  `media/chat.js:872-873`/`:901-902`) bubbles to `row.onclick` and seeds the invoke + closes the
  popover (`media/chat.js:919-926`; the wrap is inside the row, `:907-908`); with the boundary
  installed at wrap creation (which serves every `hasDetail` row, suite included), those clicks
  no longer do — a real behavior change the design's prose denies ("keeps the suite path
  byte-identical") and its suite-regression DOM test (request shape + markdown render only)
  neither catches nor codifies — what would resolve it: state the change as intended (it fixes a
  latent read-the-guide-lose-your-composer bug) and add a suite-row body-click assertion to the
  regression test.

Round 2 verdict: 0 BLOCKER / 0 MAJOR / 3 MINOR

## Plan-level pass (Loop 4)

Reviewed the translation of `03-design.md` (confirmed current: the Round-2 minors are fixed —
`03-design.md:312` comment corrected, `rootEnabled` export stated at `:360-363` and in the
"Changed in `src/capabilities.ts`" line `:390-392`, the "byte-identical" claim removed with the
suite body-click change now declared and tested via T5) into `plan.md` (10 tasks) and
`assumptions.md`.

**Checklist results.**
- *Verify commands:* T1–T3, T5–T8 verifies are behavioral (named vitest cases proving the stated
  intent, plus the `npm test` floor); all commands are Windows-PowerShell-runnable as written
  (`npx vitest run …`, `npx tsc -p . --noEmit`, `Test-Path` with backslashes, `Select-String
  -Quiet`). T9's existence-check verify is a sound composition proof (mechanism is
  existence-driven and separately tested with injected `fileExists`, `src/skill-suite.ts:216-218`;
  the file now exists). T4 and T10 are the exceptions — findings below.
- *Verification matrix:* all 7 done-criteria mapped; criterion 7 legitimately maps to
  `03-design.md` § Strategic recommendation; criterion 1's "nothing sent/executed" is concretely
  asserted in T5's DOM test, not just claimed.
- *Disposition summary:* all 6 dispositions from `03-design.md` § Dispositions present and
  unaltered — 4 survey rows (field-pair COEXIST → T8; message-pair COEXIST → T4+T5; tooltip
  COEXIST → documented; `docs/grokbit-workflows.md` LEAVE) + 2 design-introduced (markdown-payload
  COEXIST → T4/T6; `grokbit-ship` REPLACE → T9). None dropped.
- *Ordering:* dead-until-stamped is coherent — T4's branch is unreachable until T5 sends
  `detailKind` and no workflow row renders a Details button until T8 stamps `hasDetail`; T8
  correctly `depends: T4, T7`. T5 landing before T4 is also safe (suite rows send
  `detailKind:"guide"`, the old dispatch ignores unknown fields). Every `state-after: working`
  claim holds; `depends:` edges reflect real needs (T2/T3 both need T1's scanner+export; T6→T5's
  boundary/test file; T7→T6's render; T10→T8's shipped behavior).
- *Baseline honesty:* T4 names the suite Details flow; T5 names capability-row click behavior AND
  declares the deliberate suite body-click change (with a regression assertion in its verify); T6
  names the suite markdown render; T8 names the end-to-end suite flow. Honest throughout.
- *Task size/bundling:* no task exceeds ~200 changed source lines (T6 is the largest and is one
  coherent surface: view-model + render branch + CSS + their tests); no unrelated bundling.
- *Assumptions:* `assumptions.md` carries all 4 intent UNVERIFIEDs (A1–A4) and all 3 surviving
  design UNVERIFIEDs (A5–A7), correctly notes design items 3/4 as review-resolved, and `plan.md`
  § Open assumptions points at it with per-task bearings (A5/A6→T1/T2, A7→T6).

### Findings

- `[MAJOR]` T4 is a behavioral task with the degenerate compile-only verify, and no later task's
  verify ever executes its code either — evidence: T4's `verify:` is `npx tsc -p . --noEmit` +
  `npm test`, and its own note concedes the branch is "live-but-unreached"; the deferral targets
  don't cover it — T3's pure tests prove `resolveWorkflowDetailPath` only, T5/T6/T7's DOM tests
  dispatch *synthetic* `capabilityDetail` payloads (webview side only; `test/webview-harness.ts`
  stubs `postMessage`, no host), and T8's verify tests the stampers
  (`test/capabilities.test.ts`/`test/skill-suite.test.ts`), so the host branch T4 actually adds —
  allowed-roots computation + `rootEnabled` filter, realpath containment wiring, the bounded
  `min(size, WORKFLOW_DETAIL_MAX_BYTES)` read, `st.size > cap` truncation observation,
  ENOENT→`"read-failed"` mapping, `postTo` payload assembly — is proven by nothing in the plan.
  The repo's own injected-fs port idiom exists for exactly this (`CapabilityFsLike` in
  `src/capabilities.ts`, `FsLike` in `sessions.ts`, `HookFsLike` in `hook-suite.ts`) — what would
  resolve it: extract T4's branch body into an injected-fs helper (e.g.
  `readWorkflowDetail({fs, path, roots}) → payload | error` in `src/workflow-inspect.ts`) unit-
  tested in T4's verify, leaving only the one-line `postTo` glue in `sidebar.ts`; or, if the
  architect deliberately accepts untested glue (matching the shipped suite handler's own status),
  record that residual in `assumptions.md` § From verifiability — which currently claims "None"
  and would be inaccurate as written.
- `[MINOR]` T10's verify doesn't prove T10's intent — evidence: the intent names two distinct
  CLAUDE.md edits (§ Chat surfaces capability-browser bullet AND a § Known limits entry), but
  `Select-String -Path CLAUDE.md -Pattern 'workflow-inspect' -Quiet` proves only that one token
  appears somewhere in the file once — what would resolve it: two targeted patterns (one per
  section, e.g. also matching the Known-limits phrase "best-effort" beside the inspector mention),
  still one-line PowerShell.

Plan-level verdict: 0 BLOCKER / 1 MAJOR / 1 MINOR

## Plan-level pass — Architect response

- **MAJOR (T4 untested host branch) — REVISED.** T4 split into T4a (injected-fs helpers
  `workflowDetailRoots` + `readWorkflowDetail` in `src/workflow-inspect.ts`, per the
  `CapabilityFsLike`/`FsLike`/`HookFsLike` idiom, with a vitest verify covering root
  computation/`rootEnabled` filtering, the bounded read + truncation observation,
  ENOENT→`"read-failed"`, and payload assembly) and T4b (thin `sidebar.ts` glue —
  union/dispatch/signature + input-gathering + `postTo` — whose compile-only verify is now
  honest, since all branch behavior is T4a-tested); T8 `depends` and the Verification-matrix and
  Disposition rows that referenced T4 updated (criterion 3 additionally gains T4a).
- **MINOR (T10 verify) — REVISED.** T10's verify is now two section-bound patterns —
  `'workflow-inspect'` (§ Chat surfaces bullet) AND `'never executes workflow scripts'`
  (§ Known limits entry) — with the notes pinning which section carries which phrase.

## Round 2 — Architect response

All three MINORs fixed in `03-design.md`; no rebuttals.

- **MINOR 1 (`rootEnabled` export + stale "Changed in" line) — REVISED.** The resolver spec's
  root-set bullet now states `rootEnabled` is module-private (`src/capabilities.ts:694`) and must
  be exported (same one-line change as `extractMetaStringField`); the "Changed in
  `src/capabilities.ts`" summary now matches the inventory — `capabilityFromWorkflowFile` stamps
  `hasDetail`/`detailPath`/`detailKind`, `CapabilityItem` gains `detailKind`, and both
  `extractMetaStringField` and `rootEnabled` are exported.
- **MINOR 2 (stale `WORKFLOW_AGENT_CAP` comment) — REVISED.** The spec-block comment now reads
  `// parse ceiling; overflow → overflowAgentCalls, never opaque`, agreeing with the truncation
  story, the field comment, and the error table.
- **MINOR 3 ("byte-identical suite path" overstatement) — REVISED.** The propagation contract now
  declares the suite-row change explicitly: the wrap boundary fixes a latent
  read-the-guide-lose-your-composer bug (body-text/padding clicks no longer bubble to the row's
  invoke), the suite *detail flow* stays byte-for-byte while the suite row's *click surface*
  deliberately does not, and the suite-regression DOM test gains a body-click assertion (no
  invoke seed, popover stays open).
