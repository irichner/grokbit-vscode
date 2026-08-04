# Plan — Workflow details inspector + per-agent prompt editing

Slug: `workflow-details-inspector` · Approach: Extend the shipped per-row Details mechanism with a new pure best-effort workflow parser (`src/workflow-inspect.ts`), a host-stamped `detailKind` wire discriminant, a propagation-bounded in-row detail body, and seed-only per-agent edit briefs · Blast radius: ~11 source/test files + 1 bundle guide + 2 fixture files, 0 new dependencies, no schema

> Task blocks follow the parse format exactly. Design: `03-design.md` (Round 2 clean,
> 0 BLOCKER / 0 MAJOR, all MINORs fixed). Survey citations: `02-survey.md`.
> Test floor to keep green: **1603 tests / 78 files** (measured 2026-08-03).

`cwd:` is `none` throughout — single-package repo; every `verify:` runs from the repo root in
Windows PowerShell (`npm test` / `npx vitest run` / `npx tsc` / `Test-Path` / `Select-String`).

## Tasks

### T1 — Workflow call-site scanner (pure core)
- **intent:** Create `src/workflow-inspect.ts` with the string/comment-aware call-site scanner (`findCallSites`, `parseAgentArgs`, `WorkflowAgentCall`) and export `extractMetaStringField` from `capabilities.ts` for its use — no callers yet.
- **files:** `src/workflow-inspect.ts` (new), `src/capabilities.ts` (one-line export), `test/workflow-inspect.test.ts` (new)
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/workflow-inspect.test.ts` green AND `npx tsc -p . --noEmit` clean AND `npm test` green (≥1603)
- **removes:** none
- **baseline:** none (new module, no callers)
- **rollback:** discard working-tree edits to the listed files (`git checkout -- <files>`; work is uncommitted per repo convention) or `git revert <commit>` if committed
- **state-after:** working
- **notes:** Scanner mechanics generalize the `inStr`/`escape` state machine of `parseClaudeWorkflowMeta` (`src/capabilities.ts:499-544`) with `//`+`/* */` comment skipping and paren balancing; `parseAgentArgs` returns `null` for an opaque site; dynamic first arg → `promptKind: "dynamic"` + capped excerpt (~2000 chars). Adversarial tests: braces/parens in strings, `agent(` inside comments, template literals with `${`, no-opts calls, unknown opts keys, `hasSchema` key-presence. `extractMetaStringField` is module-private today (`src/capabilities.ts:448`). Fixture shape is the spec until a real script is captured (assumptions A5/A6).

### T2 — `parseWorkflowDetail` assembly + committed fixtures
- **intent:** Add `extractMetaPhases` and `parseWorkflowDetail(text, format, {truncated})` producing the full `WorkflowDetail` (agents, `agentCallSites`, `opaqueAgentCalls`, `overflowAgentCalls`, `truncated`, `WORKFLOW_AGENT_CAP`), plus one realistic multi-phase fixture per format.
- **files:** `src/workflow-inspect.ts`, `test/workflow-inspect.test.ts`, `test/fixtures/workflows/review-changes.rhai` (new), `test/fixtures/workflows/spot-review-fanout.js` (new)
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/workflow-inspect.test.ts` green (incl. agent-free script → `agentCallSites: 0`, all-opaque script, `overflowAgentCalls` distinct from opaque, `opts.truncated` stamped through, `phase("…")` inference) AND `npm test` green
- **removes:** none
- **baseline:** none
- **rollback:** discard working-tree edits to the listed files, delete the two fixture files
- **state-after:** working
- **notes:** Truncation has one owner — the host observes it and passes it in; the parser only stamps it (`03-design.md` § New pure functions). Overflow is never folded into opaque (Round-1 MINOR 6). Fixtures are committable, unlike the gitignored `.grok/`/`.claude/` (`02-survey.md` § Workflow file formats). `WORKFLOW_DETAIL_MAX_BYTES = 64*1024`, its own constant beside `HOW_IT_WORKS_MAX_BYTES`.

### T3 — `resolveWorkflowDetailPath` + `rootEnabled` export
- **intent:** Add the pure containment resolver (realpath'd requested path against injected pre-realpath'd `allowedRoots`; exact `.rhai`/`.js` extension → format; ENOENT → `"read-failed"`, containment/extension failure → `"not-a-workflow-path"`) and export `rootEnabled` from `capabilities.ts`.
- **files:** `src/workflow-inspect.ts`, `src/capabilities.ts` (one-line export, `:694`), `test/workflow-inspect.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/workflow-inspect.test.ts` green (inside root / outside root / symlink escape via injected `realpath` / wrong extension / `.rhai` vs `.js` format / ENOENT→`read-failed` / root absent from `allowedRoots` refused) AND `npm test` green
- **removes:** none
- **baseline:** none
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** `isPathContained` is already exported (`src/capabilities.ts:719-723`, verified Round 1). The host-side root policy (session backend only, `rootEnabled(r, process.env)` honored, roots realpath'd + base-contains-root checked, fail closed) is pinned in `03-design.md` § New pure functions and lands in T4.

### T4a — Injected-fs workflow-detail read helper (tested host branch body)
- **intent:** Extract the entire workflow-branch behavior into two pure/injected-fs helpers in `src/workflow-inspect.ts` — `workflowDetailRoots({roots, workspaceDir, homeDir, env, fs})` (filters `CapabilityRootSpec[]` to workflow kind via `rootEnabled`, realpaths base+dir with the base-contains-root check, fail closed) and `readWorkflowDetail({fs, requestedPath, allowedRoots})` (resolve via `resolveWorkflowDetailPath` → `stat` → bounded `min(size, WORKFLOW_DETAIL_MAX_BYTES)` read with `truncated = size > cap` observed here → parse → `{ok:true, workflow, path} | {ok:false, error}`) — so the host branch is genuinely unit-tested, not compile-checked.
- **files:** `src/workflow-inspect.ts`, `test/workflow-inspect.test.ts`
- **cwd:** none
- **depends:** T2, T3
- **verify:** `npx vitest run test/workflow-inspect.test.ts` green (root computation: `rootEnabled`/`disabledByEnv` filtering, realpath'd base-contains-root, failed-realpath root dropped; bounded read: over-cap file read to exactly the cap with `truncated: true` stamped through the parser; ENOENT → `"read-failed"`; containment/extension failure → `"not-a-workflow-path"`; success payload assembly `{workflow, path}` incl. degraded parses) AND `npx tsc -p . --noEmit` clean AND `npm test` green
- **removes:** none
- **baseline:** none (new helpers, no callers yet)
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** Injected-fs port follows the repo's `CapabilityFsLike`/`FsLike`/`HookFsLike` idiom (`src/capabilities.ts:1-20`, `src/sessions.ts`, `src/hook-suite.ts` — survey Conventions); port needs `statSync`/`realpathSync`/a bounded read (`readSlice`-style, mirroring `ClaudeFsLike`). Lives in `src/workflow-inspect.ts` per the design's module split (deep on-demand read, separate from the index-time scan).

### T4b — Host wire: `detailKind`-routed `getCapabilityDetail` glue
- **intent:** Extend the webview→host union member and dispatch to carry `detailKind`/`path`, widen `getCapabilityDetail`'s signature, and add the workflow branch as thin glue — gather inputs (`sessionCwd(session)`, `HOME || USERPROFILE || os.homedir()`, `CAPABILITY_ROOTS[session.backend]`, real `fs`) → `workflowDetailRoots` → `readWorkflowDetail` → one `postTo` per outcome — leaving the suite branch byte-for-byte for absent/non-`"workflow"` `detailKind`.
- **files:** `src/sidebar.ts` (`:145-199` union, `:3254-3255` dispatch, `:3505-3532` handler)
- **cwd:** none
- **depends:** T4a
- **verify:** `npx tsc -p . --noEmit` clean AND `npm test` green — acceptable as glue-only because every behavior in the branch (roots, bounded read, truncation, error mapping, payload assembly) is unit-tested in T4a's verify and routing/round-trip is asserted by T5/T8's DOM tests; the glue itself is input-gathering + `postTo`, matching the shipped suite handler's own thin-glue status
- **removes:** none
- **baseline:** suite Details flow — a name-only `getCapabilityDetail` must still serve the guide markdown exactly as today (`src/sidebar.ts:3505-3532`; existing tests + T5's regression DOM test)
- **rollback:** discard working-tree edits to `src/sidebar.ts`
- **state-after:** working
- **notes:** `postTo`, never `emit` (derived state must not enter the replay buffer, `src/panel-router.ts:83-85`). Branch is live-but-unreached until T5 sends `detailKind` and T8 stamps `hasDetail`. New error value `"not-a-workflow-path"`; deleted-between-scan-and-click surfaces as `"read-failed"` (mapped inside T4a's tested helper).

### T5 — Webview: propagation boundary + request echo + detail-kind titles
- **intent:** Install the single `stopPropagation` boundary on `.capability-row-detail-wrap`, make the Details click echo `{name, detailKind, path}` per the design's step 2, make the two detail-button titles detail-kind-aware, and pass `detailKind` through `capabilityGroupsView`.
- **files:** `media/chat.js` (`:857-909` region), `media/webview-helpers.js` (`capabilityGroupsView`), `test/workflow-detail.dom.test.ts` (new), `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/workflow-detail.dom.test.ts` green (blocker guard: click on open body background/edit-target leaves composer unchanged + popover open; row head still invokes; suite fixture row with `detailKind:"guide"` sends no `path` and — declared behavior change — a click on its open guide body text neither seeds the invoke nor closes the popover; detail-kind-aware titles) AND `npx vitest run test/capabilities.dom.test.ts` green AND `npm test` green
- **removes:** none
- **baseline:** capability-row click behavior — row invoke-on-click (`media/chat.js:919-926`) and the two per-button `stopPropagation` guards (`:872-873`, `:901-902`); the wrap boundary deliberately changes suite body-text clicks (fixes the latent read-the-guide-lose-your-composer bug, declared in `03-design.md` § UI structure)
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** DOM tests build fixture items carrying `detailKind` directly (the `test/capabilities.dom.test.ts` GROUPS idiom), so this task needs no host stamp. Keyboard contract: native button semantics bubble synthesized clicks through the same boundary; no `tabindex`.

### T6 — Webview: workflow detail render + degraded states + CSS
- **intent:** Add `workflowDetailView` (view-model with the `emptyLine` honesty split on `agentCallSites`, `opaqueLine`/`overflowLine`/`truncatedLine`) and the `capabilityDetail` workflow-payload branch rendering header/phases/collapsible agents via `createElement` + `textContent` only, plus the `.workflow-*` CSS.
- **files:** `media/webview-helpers.js`, `media/chat.js` (`:6096-6119` handler region), `media/chat.css` (`:2365-2422` region; `.capability-row-detail-body.workflow-detail { max-height: 420px; }`), `test/webview-helpers.test.ts`, `test/workflow-detail.dom.test.ts`
- **cwd:** none
- **depends:** T5
- **verify:** `npx vitest run test/workflow-detail.dom.test.ts test/webview-helpers.test.ts` green (structured render; agent expand/collapse; `<script>`-looking prompt lands inert via `textContent`; agent-free vs couldn't-read honesty lines; error payload → muted line; truncated notice; overflow footer distinct from opaque footer; suite markdown render unchanged) AND `npx vitest run test/chat-layout.dom.test.ts` green AND `npm test` green
- **removes:** none
- **baseline:** suite Details markdown render (`renderMarkdown` path, `media/chat.js:6114`)
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** No `@media`, no `vh`, fixed-px 420px bound (zoom-space rule, ADR 0002); new classes must not appear in `getLauncherHtml` (`test/chat-layout.dom.test.ts:116-128`). Payload branch keys on payload fields (`workflow` vs `markdown` vs `error`), never kind strings.

### T7 — Webview: per-agent edit brief + draft stash
- **intent:** Add `buildAgentEditBrief` and the per-agent edit box (input + Draft button + Enter-to-draft) seeding the composer via `insertComposerPrompt(brief, {mode:"replace"})`, with typed text stashed in `state.workflowAgentDrafts[detailPath + "#" + index]`, restored on render, cleared on Draft and `resetForNewSession`.
- **files:** `media/webview-helpers.js`, `media/chat.js`, `test/webview-helpers.test.ts`, `test/workflow-detail.dom.test.ts`
- **cwd:** none
- **depends:** T6
- **verify:** `npx vitest run test/workflow-detail.dom.test.ts test/webview-helpers.test.ts` green (brief composition exact — format line per backend, verbatim instruction, ~200-char prompt excerpt, workspace-relative path; Draft → composer contains brief and nothing was posted as a send; empty input no-op; Enter drafts; draft-stash survives a `setBusy` re-render and clears on Draft) AND `npm test` green
- **removes:** none
- **baseline:** seed-only composer contract — nothing auto-sends (existing capability-click tests)
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** Mirrors `buildWorkflowCraftBrief` (`media/webview-helpers.js:1069-1116`) and replace-mode capability-click precedent (`media/chat.js:922-926`). Stash idiom mirrors `state.capabilitiesExpanded` (`media/chat.js:1348-1405`).

### T8 — Host stamps: turn the feature on end to end
- **intent:** Stamp `hasDetail`/`detailPath`/`detailKind:"workflow"` in `capabilityFromWorkflowFile` and `detailKind:"guide"` in `attachSuiteHowItWorks`, add `CapabilityItem.detailKind` with rewritten `hasDetail`/`detailPath` doc comments — making every workflow tile render a live Details affordance.
- **files:** `src/capabilities.ts` (`:45-72`, `:568-585`), `src/skill-suite.ts` (`:207-220`), `test/capabilities.test.ts`, `test/skill-suite.test.ts`
- **cwd:** none
- **depends:** T4b, T7
- **verify:** `npx vitest run test/capabilities.test.ts test/skill-suite.test.ts` green (workflow items carry all three fields; nothing else gains them; suite items gain `detailKind:"guide"`) AND `npx vitest run test/workflow-detail.dom.test.ts` green AND `npm test` green
- **removes:** none
- **baseline:** suite Details flow end to end + Actions tiles render (existing `test/capabilities.dom.test.ts` / `test/skill-suite.test.ts`)
- **rollback:** discard working-tree edits to the listed files
- **state-after:** working
- **notes:** Stamp is unconditional for workflows — the degraded view covers unparseable scripts (Axis A3). `attachSuiteHowItWorks` stays existence-driven for `hasDetail`; it only adds the discriminant.

### T9 — `grokbit-ship` how-it-works guide (Axis D)
- **intent:** Author `resources/skills/grokbit-ship/references/how-it-works.md` so all six suite tiles render the existing Details affordance (the sixth currently renders no button — an accident of a missing file).
- **files:** `resources/skills/grokbit-ship/references/how-it-works.md` (new)
- **cwd:** none
- **depends:** none
- **verify:** `Test-Path resources\skills\grokbit-ship\references\how-it-works.md` returns `True` AND `npm test` green (`attachSuiteHowItWorks` is existence-driven, `src/skill-suite.ts:216-218` — no code change; packaging inclusion checked at release via `npx @vscode/vsce ls`)
- **removes:** none
- **baseline:** the other five guides' Details flow (unchanged)
- **rollback:** delete the file
- **state-after:** working
- **notes:** Content hand-authored from `resources/skills/grokbit-ship/SKILL.md` + `docs/grokbit-workflows.md`, matching the five existing guides' voice (`workflow-how-they-work/03-design.md`). Under `HOW_IT_WORKS_MAX_BYTES` (64KB) — trivially.

### T10 — Docs: CLAUDE.md surfaces + known limits
- **intent:** Update CLAUDE.md's § Chat surfaces capability-browser bullet and § Known limits to describe the workflow Details inspector (pure parse, best-effort, seed-only edit briefs; suite body-click fix) so the project map matches shipped behavior.
- **files:** `CLAUDE.md`
- **cwd:** none
- **depends:** T8
- **verify:** `(Select-String -Path CLAUDE.md -Pattern 'workflow-inspect' -Quiet) -and (Select-String -Path CLAUDE.md -Pattern 'never executes workflow scripts' -Quiet)` returns `True` AND `npm test` green — one pattern per edited section (see notes)
- **removes:** none
- **baseline:** none (prose only)
- **rollback:** discard working-tree edits to `CLAUDE.md`
- **state-after:** working
- **notes:** The two verify patterns are section-bound by construction: the § Chat surfaces capability-browser bullet names the new module `workflow-inspect` (its one natural home in the file), and the § Known limits entry must contain the exact phrase "never executes workflow scripts" alongside the best-effort contract (fixture-shaped until a real script is captured — assumptions A5/A6). `docs/architecture.md` gets its sync at the next release-doc pass per § Publishing step 1; not this task's scope.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion (01-intent.md) | Proven by |
|---|---|
| 1. Open Details on a workflow tile without sending/executing anything | T5 verify (Details click posts only `getCapabilityDetail`; nothing sent) + T8 verify (end-to-end with real stamps) |
| 2. Details shows name/description/phases + every agent, expand/collapse to prompt + settings | T2 verify (parser extracts all of it) + T6 verify (render + expand/collapse) |
| 3. Pure parse, never execute `.rhai`/`.js` | T1/T2 verify (pure parser tests, no eval, no new dependency) + T3 verify (containment) + T4a verify (bounded host read + root policy, injected fs — no execution path exists) |
| 4. Unparseable script → honest degraded view, never error/blank | T2 verify (degraded shapes incl. the agent-free vs couldn't-read split) + T6 verify (rendered honesty lines) |
| 5. Type an instruction at an agent → defined change mechanism | T7 verify (seed-only edit brief; nothing auto-sends) |
| 6. Suite tiles have defined, deliberate Details behavior | T9 verify (ship guide fills the gap) + T4b/T5 baselines + suite-regression DOM assertions |
| 7. Strategic question answered concretely | `03-design.md` § Strategic recommendation — a design artifact, deliberately not buildable scope; no task |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| COEXIST (`hasDetail`/`detailPath` field pair — two stampers, `detailKind` discriminant) | 1 | T8 (extends, never replaces) |
| COEXIST (`getCapabilityDetail`/`capabilityDetail` — suite branch byte-for-byte beside the workflow branch) | 1 | T4a/T4b (+ T5 regression tests) |
| COEXIST (row `title` tooltip beside click-to-expand Details) | 1 | documented, no task |
| COEXIST (`capabilityDetail` markdown payload kept as one variant of the 3-way union) | 1 | T4b/T6 |
| LEAVE (`docs/grokbit-workflows.md` — suite-scoped, gains one citation from T9) | 1 | — |
| REPLACE (`grokbit-ship` accidental no-Details state) | 1 | T9 |

Net lines: ~+1450 / −40 (estimate). The plan is additive by design: both supersession candidates
were explicit COEXIST decisions with stated reasons (`03-design.md` § Dispositions), not defaults
— the shipped suite mechanism survives on its own merits per done-criterion 6.

## Open assumptions
This is a pointer, not a copy — the full ledger is `assumptions.md`, and
`grokbit-implement`'s Software Engineer reads it before starting a task that
touches one of these. Resolve before or during implementation:

- `UNVERIFIED` A5/A6 (agent-call shape rests on fixtures, no real script captured) — bears on T1/T2.
- `UNVERIFIED` A7 (420px bounded scroll adequate for realistic agent counts) — bears on T6.
- `UNVERIFIED` A1–A4 (intake scoping decisions) — see `assumptions.md`.
- No `UNRESOLVED — Loop N` items; all loops exited under cap.

## Approval
- [x] Human approved — 2026-08-03 (Israel, in-session: "approve")

Baseline: **not waived.** Six tasks carry a non-`none` baseline (T4b, T5, T6, T7, T8, T9),
all of them guarding the shipped suite Details flow or the existing capability-row click
behavior. `grokbit-test` runs in baseline mode over exactly those before T1 starts.
