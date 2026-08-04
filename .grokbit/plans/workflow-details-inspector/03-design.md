# Design — Workflow details inspector

Inputs: `01-intent.md`, `02-survey.md`. Citations of the form `file:lines` are the survey's unless
marked *(opened this session)* — I re-read `src/capabilities.ts:448-585`, `media/chat.js:804-931`,
`src/sidebar.ts:3501-3532`, and `src/skill-suite.ts:160-235` to confirm the load-bearing details.

---

## Approaches considered

### Axis A — where agent-level detail comes from

**Option A1 — extend the pure parsers: on-demand full bounded read + best-effort structural parse.**
A new pure parse extracts `phases` from the meta block and a list of `agent(...)` call sites
(prompt literal + settings object scalars) from the whole script, read on demand with a size cap
mirroring the shipped 64KB deep-read pattern (`HOW_IT_WORKS_MAX_BYTES`, `src/skill-suite.ts:168`,
used in `src/sidebar.ts:3505-3532`) rather than the 8KB index-time head read
(`CAPABILITY_HEAD_BYTES`, `src/capabilities.ts:182,839`). Never executes the script
(intent constraint: parse only, no eval).

- For: this is the only option that satisfies done-criterion #2 ("lists every agent call … prompt
  text and its settings"). The scanning technique already exists in-repo: `parseClaudeWorkflowMeta`
  is a hand-rolled brace/quote-aware scanner with `inStr`/`escape` state
  (`src/capabilities.ts:499-544` *(opened this session)*), and `extractMetaStringField`
  (`src/capabilities.ts:448-462`) already extracts one scalar per key from a block. Generalizing
  that scanner to find call sites and balance parens is the same class of code — no AST dependency,
  consistent with ADR 0004's zero-dep decision (survey: `docs/adr/0004:16-36`, no Rhai/JS parser in
  `package.json:370-380`).
- Against: real scripts WILL defeat it — template literals with `${…}`, computed prompts, loops
  constructing agents. The survey confirms no real `.rhai` or `.claude/workflows/*.js` file exists
  on this machine (`02-survey.md` Entity resolution rows 25-26), so the `agent(prompt, opts)` shape
  rests on plan prose + test fixtures. The parser must therefore be designed around *partial
  success*, not correctness.

**Option A2 — show the raw script + meta-level structure only.**
Render name/description/phases plus the raw source (or an "Open in editor" pointer), no agent list.

- For: cannot be wrong; zero new parse code beyond `phases`.
- Against: fails done-criterion #2 outright — the intent's whole point is "which agents it runs …
  what each agent is actually told to do." Rendering kilobytes of raw Rhai/JS inside a 220px
  bounded row body (`media/chat.css:2393-2406`) duplicates the editor badly; the editor already
  exists one click away via the shipped "Open in editor" secondary button (`media/chat.js:895-905`).

**Option A3 (chosen) — hybrid: structured where parseable, honest degraded fallback where not.**
A1's parse, wrapped in an explicit confidence contract: every parse result carries what it *found*
plus what it *couldn't* read (`opaqueAgentCalls` count, `truncated` flag), and the UI renders a
degraded-but-honest view — meta + "couldn't read the agent list — open it in the editor" — whenever
the agent list comes back empty or damaged. Raw-source display is deliberately NOT part of the
fallback; "Open in editor" is the raw view (reuses `openFile`, `src/sidebar.ts:161, 2976-3012`).

**Decision: A3.** It is the only shape that satisfies both criterion #2 (structured agents) and
criterion #4 (honest degraded view, never blank/error) simultaneously. A1 alone ships the parser
without the degradation story the intent calls load-bearing; A2 would have been better at
never-wrong-ness and near-zero parse code, and that virtue is preserved as A3's fallback branch.

**Truncation/parse-failure story (decided explicitly):**

- Read cap: new constant `WORKFLOW_DETAIL_MAX_BYTES = 64 * 1024`, same value and same
  full-read-with-cap job as `HOW_IT_WORKS_MAX_BYTES` (`src/skill-suite.ts:168`) but its own
  constant — the two caps serve different content and must be tunable independently.
- Over-cap file: **parse the first 64KB and set `truncated: true`** — unlike the suite guide path,
  which refuses with `"too-large"` (`src/sidebar.ts:3518-3520` *(opened this session)*). A prose
  guide truncated mid-sentence is garbage; a structural parse of a script head still yields the
  meta block and the leading agents, and the UI states "Script larger than 64KB — showing what was
  read." Refusal would turn the biggest, most-worth-inspecting workflows into the only ones with no
  Details, inverting the feature's value.
- Zero-agents states are **two different truths and get two different sentences**, branched on
  `agentCallSites` (the count of `agent(` sites the scanner found, parseable or not):
  - `agentCallSites === 0` on a non-empty script: meta + phases (if any) + *"No agent calls found
    in this script — it may build its steps dynamically. Open it in the editor to see the full
    source."* A legitimately agent-free workflow (pure `pipeline()` lambdas, computed dispatch) is
    not a parse failure and must never be described as one — Axis A3's whole pitch is honesty.
  - `agentCallSites > 0` but `agents: []` (every site defeated the extractor): meta + phases + the
    degraded line *"Couldn't read the agent list from this script — open it in the editor to see
    the full source."*
  Neither is ever an error card or a blank body (criterion #4).
- Individually unparseable calls: an `agent(` call site whose args defeat the extractor is counted,
  not dropped silently — the list footer renders *"+N agent call(s) couldn't be read"* when
  `opaqueAgentCalls > 0`.
- Cap overflow is its own count, never folded into the opaque one: sites past
  `WORKFLOW_AGENT_CAP` are *unexamined*, not damaged — the parser stops attempting them, so
  reporting them as "couldn't be read" would misstate readable calls as unreadable (the inverse of
  the zero-agents honesty defect). They accumulate in `overflowAgentCalls` and render as a separate
  footer line *"+N more agent call(s) not shown"*.
- Dynamic prompts: a first argument that is not a plain string literal (template literal containing
  `${`, an identifier, a concatenation) yields `promptKind: "dynamic"` with a short raw excerpt
  rendered as inert text — labelled "computed at run time," not passed off as the literal prompt.

### Axis B — where the Details UI lives

**Option B1 (chosen) — extend the shipped per-row detail mechanism.**
Reuse `hasDetail`/`detailPath` + the `getCapabilityDetail`/`capabilityDetail` round-trip + the
bounded `.capability-row-detail-body` (`media/chat.js:857-909` *(opened this session)*,
`src/sidebar.ts:3505-3532`, `media/chat.css:2365-2422`), with a new workflow branch on both ends.

- For: **inherits the four-anchor lifecycle for free** — the survey's Danger zones flag this
  exactly: a detail body inside `buildCapabilityRow` participates in
  `initialized`/`setBusy`/`showOnboarding`/`clearWelcome`+`resetForNewSession` by virtue of living
  inside the panel/popover render functions, while a separate overlay "would need its own
  state-reset discipline" (survey Danger zones; `docs/adr/0002:101-108,158-164`). It also inherits
  the locked-while-priming treatment (`detailBtn.disabled` branch, `media/chat.js:891-893`), the
  "Open in editor" secondary button verbatim (`media/chat.js:895-905` posts
  `{type:"openFile", path: item.detailPath}` — for a workflow, `detailPath` = the script itself),
  and the pending-target stash/clear discipline (`state.pendingCapabilityDetail`,
  `media/chat.js:881-888`). Smallest addition to the two large frequently-touched files the survey
  flags (`media/chat.js` 7089 lines, `src/sidebar.ts` 5466 lines).
- Against: the body is `max-height: 220px` (`media/chat.css:2393-2406`) — cramped for N agents with
  prompts. Mitigation below.

**Option B2 — full-canvas overlay mirroring `#workflow-builder`** (`media/chat.js:935-1290`,
`media/chat.css:2123-2132`), possibly UNIFIED: the Builder's phase/agent canvas rendering a parsed
existing workflow read-only.

- For: room. Focus-trap/Escape/dirty-confirm plumbing already exists (`media/chat.js:960-1047`).
  Builder-as-viewer is elegant on paper and would pre-build the eventual "edit a parsed workflow in
  the canvas" future.
- Against: the Builder's draft model was built for authoring *new* workflows
  (`.grokbit/plans/user-workflows-display-builder/01-intent.md` — done criteria entirely about
  creating; survey Prior attempts), not round-tripping parsed ones — a parse that is *best-effort
  and lossy by design* (Axis A) cannot honestly populate an authoring canvas without implying the
  canvas could write it back, which Axis C rejects. A new overlay is also outside the four-anchor
  cycle (survey Danger zones) and needs its own reset/focus discipline. And it risks tripping
  `test/chat-layout.dom.test.ts`'s source-checking guards (survey Danger zones,
  `test/chat-layout.dom.test.ts:116-128`).

**Option B3 — popover** (the `openCapabilitiesPopover` idiom, `media/chat.js:1517-1622`).

- Against quickly: the workflow tiles already live *inside* the capabilities popover; a
  popover-from-a-popover has no anchor precedent in the file, and it inherits none of the row's
  detail plumbing. No stronger than B1 on any axis the constraints care about.

**Decision: B1**, with one CSS accommodation: a modifier class on the workflow detail body
(`.capability-row-detail-body.workflow-detail { max-height: 420px; }`) — a raised fixed-px bound,
not `vh` (viewport units evaluate against the unzoomed viewport while the content sits in the
`zoom`-scaled space — the same class of lie ADR 0002 bans `@media` for; fixed px scale with `zoom`
consistently — survey Conventions / `docs/adr/0002` rules restated in survey row Prior attempts).
Agent entries are individually collapsible (below), so 420px of bounded scroll holds a realistic
list. B2 would have been better at: raw room, and a head start on a future canvas-based editor —
explicitly deferred, not precluded (the parse output is UI-agnostic; a later overlay can consume
the same `WorkflowDetail` payload).

### Axis C — the "change an agent by typing a prompt" mechanism

**Option C1 (chosen) — seed-only: per-agent edit box composes a precise edit brief and seeds the
composer.**

- For: reuses the entire shipped chain — `buildWorkflowCraftBrief` →
  `insertComposerPrompt(brief, {mode:"replace"})` is the exact precedent
  (`media/webview-helpers.js:1069-1116`, `media/chat.js:1279-1286`), and capability-row clicks
  already use replace-mode seeding (`media/chat.js:922-926`; `workflow-seed-replace-last` design,
  survey Prior attempts). The CLI agent applies the edit with its own file tooling under the user's
  normal permission flow — which is *good* at precise single-site edits, and is the only actor that
  can correctly modify Rhai/JS it understands. Keeps the seed-only contract (intent constraint) and
  the thin-client philosophy intact. Nothing auto-sends; the user reviews the brief in the composer.
- Against: less "direct" — the change lands only after the user presses Send and the agent runs a
  turn. Accepted: that indirection *is* the permission model.

**Option C2 — new webview→host write channel + extension-side text surgery.**

- For: instant gratification; works with no live agent turn.
- Against, decisive: no webview→host content-write channel exists — the survey enumerates the full
  message union (`src/sidebar.ts:145-199`) and confirms `DOES NOT EXIST`; inventing one creates a
  file-mutation path entirely outside the ACP permission model (the only write path today is the
  agent's own `fs/write_text_file`, `src/sidebar.ts:2403-2415`). The extension would have to
  round-trip an edit into two untrusted, backend-native syntaxes it can only regex-scan — the
  survey's own parser findings show how partial that understanding is — so "extension-side text
  surgery" would corrupt exactly the scripts the parser already struggles with. It also contradicts
  the intent's seed-only assumption unless explicitly justified, and no done criterion requires the
  directness it buys. C2 would have been better at: immediacy and offline use (no session needed).
  Not worth a new write path.

**Decision: C1.** Brief composition specified in the Chosen design.

### Axis D — suite tiles + the `grokbit-ship` gap

**Option D1 (chosen) — fill the gap:** author `resources/skills/grokbit-ship/references/how-it-works.md`
so all 6 suite tiles render the existing Details affordance. The survey confirms `grokbit-ship` is
the only member without a guide (Absences; `Glob resources/skills/grokbit-ship/**` → only
`SKILL.md`), and `attachSuiteHowItWorks` already stamps `hasDetail` automatically the moment the
file exists (`src/skill-suite.ts:207-220` *(opened this session)* — existence-checked per item, no
code change needed). Content is hand-authored from `SKILL.md` + `docs/grokbit-workflows.md`,
matching the 5 existing guides' voice (survey Prior attempts: `workflow-how-they-work/03-design.md`
chose curated static guides deliberately).

**Option D2 — LEAVE:** declare "no Details on ship" the deliberate behavior.

- Against: criterion #6 asks for "defined, deliberate Details behavior … not an accidental broken
  click." Today ship's tile simply renders no button — that's an accident of a missing file, and
  documenting the accident is more words than fixing it. D2 would have been better at: zero content
  to write and maintain. One markdown file is cheap; **D1.**

Suite tiles otherwise keep their existing behavior unchanged: static curated markdown via the
name-allowlisted suite branch — they are skills, not scripts; there is nothing to parse
(criterion #6 satisfied as "show the skill's pipeline summary").

---

## Chosen design

### Data flow (host → webview and back)

1. **Index time (unchanged cost):** two stampers now mark detail-capable items, and each stamps a
   **`detailKind`** discriminant alongside the existing field pair:
   - `capabilityFromWorkflowFile` (`src/capabilities.ts:568-585` *(opened this session)* — today it
     stamps neither field) additionally stamps `hasDetail: true`, `detailPath: filePath`, and
     `detailKind: "workflow"` on every workflow item it builds. No extra I/O — the flag is
     unconditional for workflows because the degraded view covers unparseable ones (Axis A3).
   - `attachSuiteHowItWorks` (`src/skill-suite.ts:207-220` *(opened this session)*) additionally
     stamps `detailKind: "guide"` next to the `hasDetail`/`detailPath` it already sets.
   `CapabilityItem` gains `detailKind?: "guide" | "workflow"` (`src/capabilities.ts:45-72`), and
   `capabilityGroupsView` passes it through to the row model exactly as it already passes
   `hasDetail`/`detailPath` (`media/webview-helpers.js:1137-1140`, `:1156-1157` *(opened this
   session)*). The existing renderer branch `if (item.hasDetail)` (`media/chat.js:860`) then gives
   every workflow tile a Details button and, via `detailPath`, the "Open in editor" secondary
   button, both for free.

   **Why a host-stamped `detailKind`, not "path present" and not the item's `kind`.** "Populated
   only when the item has a `path`" is not a usable discriminant: suite items DO carry `path`
   (their scanned `SKILL.md` — `applySuiteKind` and `attachSuiteHowItWorks` both spread-copy the
   item and never strip it, `src/skill-suite.ts:156-163`, `:212-218` *(opened this session)*; and
   `capabilityGroupsView` forwards `path` to the row model, `media/webview-helpers.js:1127`,
   `:1149`), so a path-presence rule would route every suite Details click into the workflow
   branch and regress it to `"not-a-workflow-path"`. Branching on `item.kind === "workflow"` in
   the webview would violate the renderer's standing never-branch-on-kind rule
   (`media/chat.js:805-807`), and `kind` is a display/grouping concept — if a future kind ever
   grows a parsed detail, `kind` wouldn't say *which detail flavor* its payload is.
   `detailKind` names the actual variable (what content the host stamped behind the Details
   button) and mirrors the shipped `control === "switch"` precedent: shape/behavior encoded in a
   dedicated field, never in kind strings.
2. **Click:** the webview's existing detail click handler is extended to echo the host-stamped
   fields: `{ type: "getCapabilityDetail", name: item.name, detailKind: item.detailKind,
   path: item.detailKind === "workflow" ? item.detailPath : undefined }`. (Reading `detailKind` is
   reading a shape field, same as `control` — not a kind-string branch.) Suite tiles therefore
   send `detailKind: "guide"` and no `path`; a legacy/absent `detailKind` degrades to the shipped
   suite behavior on the host side. The echo is a *lookup hint*, never authorization — see the
   security note.

   **Changed dispatch surface (correcting a Round-1 grounding error):** the current dispatch site
   does **not** pass the whole message — it extracts only the name
   (`this.getCapabilityDetail(session, typeof msg.name === "string" ? msg.name : "")`,
   `src/sidebar.ts:3254-3255` *(opened this session)*), and the private handler's signature is
   `(session, name: string)` (`src/sidebar.ts:3505`). Both change: the dispatch also extracts
   `msg.detailKind`/`msg.path` (string-typed or dropped), and the signature becomes
   `(session, name: string, detailKind?: string, requestedPath?: string)`. The union member at
   `src/sidebar.ts:198` gains both optional fields.
3. **Host branch** in `getCapabilityDetail` (`src/sidebar.ts:3505-3532`), keyed on the echoed
   `detailKind`:
   - `detailKind !== "workflow"` (including absent/unknown) → existing suite flow, byte-for-byte
     (`resolveSuiteHowItWorksPath` name-allowlist, `HOW_IT_WORKS_MAX_BYTES`, markdown reply). The
     suite branch ignores any `path` field entirely.
   - `detailKind === "workflow"` → **workflow flow**: resolve `requestedPath` through the new pure
     `resolveWorkflowDetailPath` (below); on `ok`, `statSync`, read `min(size,
     WORKFLOW_DETAIL_MAX_BYTES)` bytes, run
     `parseWorkflowDetail(text, format, { truncated: size > WORKFLOW_DETAIL_MAX_BYTES })`, and
     `postTo(session, { type: "capabilityDetail", name, workflow, path })`. Truncation is a
     read-time fact only the host can observe (the parser sees already-sliced text), so the host
     measures it and hands it in; it lives **only** on `WorkflowDetail.truncated` — there is no
     top-level `truncated` on the wire envelope. On any failure:
     `postTo(session, { type: "capabilityDetail", name, error })` with the existing error idiom
     plus new values `"not-a-workflow-path"` / `"read-failed"` (a file deleted between scan and
     click surfaces as `"read-failed"`, not `"not-a-workflow-path"` — see
     `resolveWorkflowDetailPath` below). `postTo`, never `emit` — derived, refreshable state must
     not enter the replay buffer (survey Conventions, `src/panel-router.ts:83-85`; both existing
     capability messages already use `postTo`).
4. **Webview render:** the `capabilityDetail` handler (`media/chat.js:6096-6119`) branches: payload
   has `workflow` → build the structured view via the new pure `workflowDetailView` and render it
   with DOM + `textContent` only; payload has `markdown` → existing `renderMarkdown` path unchanged
   (`media/chat.js:6114`). The `state.pendingCapabilityDetail` stash/clear discipline is reused
   as-is (`media/chat.js:881-888`).

### New/changed message shapes

| Message | Direction | Change |
|---|---|---|
| `getCapabilityDetail` | webview → host | gains optional `detailKind?: string` and `path?: string` (`src/sidebar.ts:198` union member); the dispatch site — which today extracts **only** `msg.name` (`src/sidebar.ts:3254-3255` *(opened this session)*) — is extended to extract both new fields, and the private handler's `(session, name)` signature (`src/sidebar.ts:3505`) grows the two parameters |
| `capabilityDetail` | host → webview | becomes a 3-way union: `{name, markdown, path}` (existing) \| `{name, workflow: WorkflowDetail, path}` (new; truncation travels inside `workflow.truncated`, never as an envelope field) \| `{name, error}` (existing, +`"not-a-workflow-path"`) |

No other message changes. The `capabilities` payload shape (`src/sidebar.ts:3419-3499`) is
untouched except for the stamped fields: `hasDetail`/`detailPath` already exist on
`CapabilityItem` (`src/capabilities.ts:65-71`); `detailKind` is the one new field.

**Changed-surfaces inventory (small but easy-to-miss edits):**

- `src/sidebar.ts:3254-3255` — dispatch extracts `msg.detailKind`/`msg.path` in addition to
  `msg.name`; `getCapabilityDetail` signature change (`:3505`).
- `src/capabilities.ts:64-71` — the `hasDetail`/`detailPath` doc comments are falsified by the
  second stamper and must be rewritten: `hasDetail` is set by `attachSuiteHowItWorks` (suite
  guides) **or** `capabilityFromWorkflowFile` (workflow scripts); `detailPath` is "the guide file
  or the workflow script, per `detailKind`" — not "Absolute path to `references/how-it-works.md`".
- `media/chat.js:867` — `detailBtn.title = "How this workflow works (roles, loops, caps)"` is
  suite-guide copy; it becomes detail-kind-aware: `detailKind === "workflow"` → *"What this
  workflow runs (agents, phases, prompts)"*, else the existing string.
- `media/chat.js:900` — Open-in-editor's `"Open the full how-it-works guide as a file"` likewise:
  workflow rows get *"Open the workflow script in the editor"*.
- `media/webview-helpers.js:1137-1157` — `capabilityGroupsView` passes `detailKind` through to the
  row model (same treatment as `hasDetail`/`detailPath`).

### New pure functions and where they live

**New pure module `src/workflow-inspect.ts`** — deep on-demand parse, separate from
`src/capabilities.ts`'s index-time scan. Justification for a new file rather than growing
capabilities.ts: the survey flags capabilities.ts at 953 lines (Danger zones); the repo's dominant
pattern is one pure module per policy concern (survey Conventions: pure-vs-impure split documented
in both `src/capabilities.ts:1-20` and `src/skill-suite.ts:1-26`), and index-scan vs. deep-read are
already two distinct bound strategies in two files (`CAPABILITY_HEAD_BYTES` vs.
`HOW_IT_WORKS_MAX_BYTES`, survey Reusable code). No `vscode`, no top-level `node:fs`; imports types
+ `extractMetaStringField` from `capabilities.ts` (export it if not already — it is currently a
module-private function, *(opened this session)* `src/capabilities.ts:448`).

```
WORKFLOW_DETAIL_MAX_BYTES = 64 * 1024
WORKFLOW_AGENT_CAP = 40            // parse ceiling; overflow → overflowAgentCalls, never opaque

interface WorkflowAgentCall {
  index: number;                    // 1-based order of appearance
  promptKind: "literal" | "dynamic";
  prompt?: string;                  // literal text, or raw excerpt when dynamic (capped ~2000 chars)
  label?: string; phase?: string;   // phase = explicit opt, else inferredPhase
  inferredPhase?: string;           // last preceding phase("…") literal, Rhai + JS alike
  model?: string; effort?: string; agentType?: string; isolation?: string;
  hasSchema: boolean;               // key-presence only, never parsed
}
interface WorkflowDetail {
  name?: string; description?: string;
  phases: { title: string; detail?: string }[];
  agents: WorkflowAgentCall[];
  agentCallSites: number;           // total agent( sites found (parsed + opaque + overflow)
  opaqueAgentCalls: number;         // sites attempted but not parseable
  overflowAgentCalls: number;       // sites past WORKFLOW_AGENT_CAP — unexamined, never "opaque"
  truncated: boolean;               // host-observed read-time fact, passed in (see below)
}

parseWorkflowDetail(text, format: "rhai" | "claude-js",
                    opts?: { truncated?: boolean }): WorkflowDetail
extractMetaPhases(metaBlock, format): {title, detail?}[]      // bracket-balanced, string-aware
findCallSites(text, fnName, format): {start, argsText}[]      // string+comment-aware scan, paren-balanced
parseAgentArgs(argsText, format): WorkflowAgentCall | null    // null ⇒ counts as opaque
resolveWorkflowDetailPath({ requestedPath, allowedRoots, realpath }):
  { ok: true; path: string; format: "rhai" | "claude-js" }
  | { ok: false; error: "not-a-workflow-path" | "read-failed" }
```

`truncated` has exactly one owner: the **host** observes it at read time
(`st.size > WORKFLOW_DETAIL_MAX_BYTES`) — the parser cannot see it from already-sliced text — and
passes it into `parseWorkflowDetail`, which stamps it onto the returned `WorkflowDetail`. It never
appears as a wire-envelope field (the message table above matches), so the view-model consumes one
self-contained object.

**`resolveWorkflowDetailPath` — the spec, pinned (it is *modelled on* the scan's containment, with
each divergence stated):**

- **Both sides are realpath'd.** The host builds `allowedRoots` by realpath-resolving each
  candidate workflow root *and its base* and applying the same base-contains-root check the scan
  applies (`realpathSync(base)` / `realpathSync(dir)` → `isPathContained`,
  `src/capabilities.ts:762-773` *(opened this session)*); a root that fails realpath or
  containment is dropped before injection — fail closed. The pure function then realpaths
  `requestedPath` (via the injected `realpath`) and requires `isPathContained(root, real)` for
  some allowed root (`isPathContained` is exported, `src/capabilities.ts:719-723` — confirmed by
  the Round-1 review, resolving former Assumption 3).
- **Root set = the session's backend only, `rootEnabled` honored.** The host computes
  `allowedRoots` at the detail-handler call site from
  `CAPABILITY_ROOTS[session.backend].filter(r => r.kind === "workflow" && rootEnabled(r, process.env))`
  — `rootEnabled` is currently module-private (`src/capabilities.ts:694`) and must be exported,
  the same one-line change as `extractMetaStringField` —
  resolved against the same `workspaceDir`/`homeDir` inputs `listCapabilities` already computes
  per call (`sessionCwd(session)`; `HOME || USERPROFILE || os.homedir()` —
  `src/sidebar.ts:3419-3441` *(opened this session)*; recomputing is cheap, resolving former
  Assumption 4). Honoring `disabledByEnv` (e.g. `GROK_WORKFLOWS`, `src/capabilities.ts:147-148`)
  matters: a root the scan won't list must not remain servable by the detail read, or disabling
  discovery would leave a live read channel into it.
- **ENOENT is `"read-failed"`, not `"not-a-workflow-path"`.** The injected `realpath` reports
  resolution failure distinctly (returns `null`/throws → the resolver maps it to
  `{ ok: false, error: "read-failed" }`): a file deleted between scan and click is a read problem,
  not a containment violation, and labelling it "not a workflow path" would be a lie about a path
  the scan itself produced. Containment failure and a wrong extension remain
  `"not-a-workflow-path"`.
- **Extension check as in the scan:** exact `.rhai`/`.js` suffix (case-insensitive), mirroring
  `src/capabilities.ts:805-812`, which also determines `format`.

Scanner mechanics reuse the in-repo idiom, not a dependency: `findCallSites` walks characters with
the `inStr`/`escape` state machine `parseClaudeWorkflowMeta` already implements
(`src/capabilities.ts:505-535` *(opened this session)*), extended with `//` and `/* */` comment
skipping (both syntaxes use them); each `agent(` hit outside string/comment is paren-balanced
(string-aware) to slice the call. `parseAgentArgs`: first arg starting with `"`/`'`/`` ` `` →
literal read (a backtick literal containing `${` → `promptKind:"dynamic"` with raw excerpt);
anything else → dynamic excerpt. Second arg starting `#{` (Rhai) / `{` (JS) → brace-balanced block
→ `extractMetaStringField` per scalar key; `hasSchema` via key-presence regex. A linear pass also
records `phase("…")` literals so agents without an explicit `phase` opt get `inferredPhase`.

**Changed in `src/capabilities.ts`:** `capabilityFromWorkflowFile` stamps
`hasDetail`/`detailPath`/`detailKind: "workflow"`; `CapabilityItem` gains `detailKind`;
`extractMetaStringField` and `rootEnabled` exported (both currently module-private,
`src/capabilities.ts:448`, `:694`).

**New in `media/webview-helpers.js`** (pure, shared with tests — survey Reusable code):

- `workflowDetailView(detail)` — view-model: per-agent one-line summary
  (`label ?? "agent N"` · phase · model · effort · `schema ✓`), prompt display text with the
  dynamic-prompt label, and the footer/empty lines as *strings decided here, not in the DOM code*:
  `emptyLine` (branched on `agentCallSites` — the "no agent calls found / couldn't read" honesty
  split from Axis A3), `opaqueLine` (`+N agent call(s) couldn't be read`), `overflowLine`
  (`+N more agent call(s) not shown`), `truncatedLine`. Mirrors `capabilityGroupsView`'s role
  (`media/webview-helpers.js:1118-1180`).
- `buildAgentEditBrief({ workflowName, workflowPath, format, agent, instruction })` — mirrors
  `buildWorkflowCraftBrief` (`media/webview-helpers.js:1069-1116`). Exact composition:

  ```
  Edit one agent inside an existing workflow. Do not run the workflow.

  Workflow: <name>
  File: <workflowPath>            (workspace-relative when under the workspace)
  Format: Grok Rhai — keep it Rhai | Claude Code JS — keep it JS (no cross-format changes)

  Target agent: #<index><, label "<label>"><, phase "<phase>">
  Its current prompt begins:
  > <first ~200 chars of prompt / "(computed at run time)" excerpt>

  Requested change:
  <the user's typed instruction, verbatim>

  Apply the smallest edit that makes this change to that one agent only —
  leave the meta block and every other agent untouched. Show me the diff.
  ```

  The prompt excerpt is the disambiguator (labels are optional in real scripts); index + phase +
  excerpt together let the CLI agent locate the call site reliably even after the file drifts.

### UI structure (webview, `media/chat.js`)

Inside the existing `detailBody` (`.capability-row-detail-body`, now also `.workflow-detail` for
workflow payloads), all built with `createElement` + `textContent`:

- Header: description (if any) + phase chips (`.workflow-detail-phase`).
- Agent list: one `.workflow-agent` block per entry — a summary `<button>` row
  (chevron + the view-model's one-liner, `aria-expanded`) toggling a hidden body containing the
  prompt in a `<pre class="workflow-agent-prompt">` (bounded `max-height` + `overflow:auto`,
  `white-space: pre-wrap`), a settings list, and the **edit box**: a one-line
  `<input>` (placeholder *"Describe a change to this agent…"*) + a *Draft edit prompt* button whose
  handler builds `buildAgentEditBrief` → `insertComposerPrompt(brief, {mode:"replace"})` →
  `closePopovers()` — replace-mode per the shipped capability-click precedent
  (`media/chat.js:922-926`). Empty input → button no-ops (disabled state). Nothing ever auto-sends.
- Footers as applicable (all view-model strings, see `workflowDetailView`): the `emptyLine`
  honesty split, `opaqueLine`, `overflowLine`, `truncatedLine`. Errors from the host render the
  same muted single-line treatment the suite branch already gives error payloads
  (`media/chat.js:6096-6119` region).

**Event-propagation contract (the row is invocable; the detail body must be a dead zone for the
row's click).** Workflow items carry `invoke`, so `capabilityGroupsView` gives their rows
`action: "invoke"` (`media/webview-helpers.js:1129-1131` *(opened this session)*) and
`buildCapabilityRow` installs `row.onclick = … insertComposerPrompt(item.invoke, {mode:"replace"});
closePopovers();` (`media/chat.js:919-926` *(opened this session)*). The detail wrap is appended
*inside* that row (`media/chat.js:907-908`), and the shipped mechanism survives only because its
two buttons each call `e.stopPropagation()` (`media/chat.js:872-873`, `:901-902` *(opened this
session)*). Per-child guards do not scale to a body full of interactive children *and*
selectable text (click-dragging to select prompt text also dispatches a `click` at the row), so
the contract is a **single boundary**:

- `detailWrap` (`.capability-row-detail-wrap`) gets one capture-free
  `detailWrap.addEventListener("click", (e) => e.stopPropagation())` installed alongside its
  creation. Every click inside the wrap — Details button, Open in editor, agent summary buttons,
  the edit `<input>` (focusing it), the Draft button, the `<pre>` prompt text, footer lines, and
  bare padding — stops at the boundary: it never reaches `row.onclick` (no composer clobber) and
  never reaches the document-level `closePopovers()` listener (the popover stays open; on the
  welcome-panel mount there is no popover and the guard is simply inert). The two existing
  per-button `stopPropagation` calls become redundant but stay.

  **Declared behavior change on suite rows (intended, beneficial):** the wrap boundary serves
  every `hasDetail` row, suite included, so it also changes shipped suite-row behavior — today a
  click on a suite guide's rendered body text or the wrap's padding (anywhere but the two guarded
  buttons) bubbles to `row.onclick` and seeds the invoke + closes the popover mid-read
  (`media/chat.js:919-926`; the wrap sits inside the row, `:907-908`). That is a latent
  read-the-guide-lose-your-composer bug, and the boundary fixes it as a side effect. The suite
  *detail flow* (request shape, name allowlist, markdown render) stays byte-for-byte; the suite
  row's *click surface* deliberately does not, and the suite-regression DOM test codifies both:
  request/render unchanged, AND a click on an open guide's body text neither seeds the invoke nor
  closes the popover.
- **The row outside the wrap keeps its invoke behavior even while the body is open** — clicking
  the row head still seeds `/workflow <name>` and closes the popover, exactly as a suite row with
  an open guide behaves today. Deliberate: the head is the invoke surface, the wrap is the
  inspection surface, and changing head behavior based on body state would make the same pixels do
  different things at different times.
- **Keyboard:** all controls are native `<button>`/`<input>` in DOM order (Details → Open in
  editor → per-agent summary buttons → each open agent's input → Draft), so Tab order needs no
  `tabindex`. Enter/Space on a summary button toggles it (native button semantics dispatch
  `click`, which the wrap boundary also absorbs — keyboard activation cannot invoke the row
  either, since the row's handler is a `click` handler on the row and buttons' synthesized clicks
  bubble through the same boundary). Enter in the edit `<input>` triggers the same Draft routine
  as the button when non-empty (a `keydown` handler; no `<form>` is introduced). After Draft, the
  existing `insertComposerPrompt` + `closePopovers()` flow moves the user to the composer to
  review the brief. Escape keeps its existing document-level popover-close behavior — typed draft
  text survives it via the stash below.
- **DOM test (blocker guard):** with a workflow detail body open, (1) a click on the body
  background and on the edit input asserts the composer is unchanged and the popover still open;
  (2) a click on the row head asserts the invoke *does* seed and the popover closes (regression
  in the other direction).

**Draft-text persistence (re-render survival).** The detail body is rebuilt from scratch whenever
its mount re-renders (`setBusy` fires on every transition, plus `modeChanged`/`backendChanged`/
refresh/`commandsUpdate` re-posts), which closes the body — acceptable for *expansion state*
(cheap to redo), but silently destroying a typed-but-undrafted instruction is a materially worse
loss. So the edit input's text is stashed, mirroring the `state.capabilitiesExpanded` idiom
(`media/chat.js:1348-1405`): an `input` listener writes to
`state.workflowAgentDrafts[detailPath + "#" + agent.index]`, the render reads it back when
building each agent's edit box, and the entry is cleared on a successful Draft (the text now lives
in the composer) and in `resetForNewSession` (a fresh session inherits no drafts — same clearing
point as `capabilitiesExpanded`). Per-agent *expanded/collapsed* state remains DOM-local and
resets on re-render — accepted, not fought; only the typed text is worth preserving.

### CSS approach

New rules in `media/chat.css` under the existing capability-detail block (`:2365-2422` region):
`.capability-row-detail-body.workflow-detail { max-height: 420px; }`, `.workflow-agent`,
`.workflow-agent-prompt`, `.workflow-detail-phase`, degraded/notice lines. All colors via
`var(--vscode-*)` tokens only (survey Conventions). No `@media` ever; no `vh` (zoom-space mismatch,
Axis B). No grid tracks with pixel floors are introduced (stacked block layout), so no new
`min(100%, …)` clamps are needed — noted so the layout guard test has nothing to catch. None of the
new classes/ids may appear in `getLauncherHtml` (survey Danger zones,
`test/chat-layout.dom.test.ts:116-128`).

### Lifecycle anchors

Nothing new to wire: the Details body lives inside `buildCapabilityRow`, which is rendered by the
panel/popover functions already driven by the four anchors
(`initialized`/`setBusy`/`showOnboarding`×4/`clearWelcome`+`resetForNewSession`) — survey Danger
zones states this inheritance explicitly, and it is the primary reason Axis B chose B1. Locked
state: the detail button is already `disabled` while locked (`media/chat.js:891-893`), and the edit
box only exists inside a body that can only be opened unlocked.

### Security posture

- **Path containment, not name allowlist.** The workflow branch must NOT reuse
  `resolveSuiteHowItWorksPath` — its `SUITE_SKILL_NAMES` allowlist structurally cannot serve
  arbitrary paths (survey Supersession row 2; `src/skill-suite.ts:227-235` *(opened this
  session)*). `resolveWorkflowDetailPath`'s full spec is pinned above (§ New pure functions):
  roots realpath'd host-side with the scan's own base-contains-root check
  (`src/capabilities.ts:762-773`), session-backend workflow roots only with `rootEnabled`
  honored, exact `.rhai`/`.js` extension per the scan's filter (`src/capabilities.ts:805-812`).
  Neither of the webview's echoed fields is an authorization: `path` is a *lookup hint* (a hostile
  or buggy message can only ever read a workflow-shaped file inside roots the scan already reads),
  and `detailKind` is a *routing hint* — lying about it merely selects the other branch, and each
  branch is independently safe (name allowlist vs. root containment). No combination of forged
  fields reads anything either branch wouldn't serve honestly.
- **Untrusted content renders inert.** Script text (prompts, labels, excerpts) is never markdown
  and never `innerHTML` — `textContent`/`createElement` only; the suite branch keeps its existing
  safe `renderMarkdown` pipeline (`media/chat.js:6114`). Workflow files are untrusted repo content
  (intent constraint); the only place their text leaves the detail view is the edit brief, which
  lands in the composer where the user reads it before sending — the seed-only contract is also the
  prompt-injection review gate.
- **Bounded everything:** 64KB read cap, `WORKFLOW_AGENT_CAP` on parsed agents, ~2000-char prompt
  excerpt cap, paren/brace balancing with hard iteration bounds. No execution, no `eval`, no new
  dependency (ADR 0004; `package.json:370-380`).
- **No write path.** Axis C1 — the only mutation route remains the CLI agent's own
  `fs/write_text_file` under the permission flow (`src/sidebar.ts:2403-2415`).

### Error/degraded states (complete enumeration)

| Condition | Wire | Render |
|---|---|---|
| Path outside roots / wrong extension / symlink escape | `error: "not-a-workflow-path"` | muted one-liner |
| File deleted between scan and click (realpath ENOENT) | `error: "read-failed"` | muted one-liner |
| stat/read failure | `error: "read-failed"` | muted one-liner |
| File > 64KB | `workflow.truncated: true` | full view + truncation notice |
| No `agent(` sites at all (`agentCallSites: 0`) | `workflow` (agents `[]`) | meta/phases + "No agent calls found in this script — it may build its steps dynamically…" |
| Sites found, none parseable (`agentCallSites > 0`, agents `[]`) | `workflow` | meta/phases + "Couldn't read the agent list…" + Open in editor |
| Some calls unparseable | `workflow.opaqueAgentCalls > 0` | list + "+N agent call(s) couldn't be read" |
| Readable calls past the cap | `workflow.overflowAgentCalls > 0` | list + "+N more agent call(s) not shown" (never conflated with the opaque line) |
| Dynamic prompt | `promptKind: "dynamic"` | excerpt labelled "computed at run time" |

---

## Strategic recommendation (Axis E)

**Yes — the workflow inspector is the right place to start. Do not build a multi-workflow
execution surface now.**

Why the inspector first: it completes a ladder this extension has already climbed three rungs of —
discover workflows as tiles (`user-workflows-tile`), create them (Builder + Craft with AI,
`user-workflows-display-builder`), invoke them (seed-only `/workflow <name>`). "See inside one" is
the missing rung, it is pure-read (fits the thin-client philosophy exactly — all session state
lives in the CLI; CLAUDE.md header), and it compounds: the same `WorkflowDetail` payload a future
run-visibility or canvas-edit surface would need is exactly what this ships.

Why *not* a "run multiple workflows" feature now:

- **The extension has no execution substrate to build on.** Runs happen in the CLI chat; there is
  no execution UI today and the prior intent explicitly non-goaled an extension-hosted execution
  engine (`user-workflows-display-builder/01-intent.md:32`, survey Prior attempts; this intent
  repeats the non-goal). An orchestrator UI ("run these three workflows") would either shell out
  around the CLI's own permission model or reimplement scheduling the CLIs already own — Claude
  Code's Workflow tool orchestrates subagents itself and has its own `/workflows` watch surface;
  Grok Build dispatches subagents and owns worktrees. The extension's leverage is *windows onto*
  CLI-owned state, never a second engine.
- **The demand signal is inspection-shaped.** The user's actual pain ("workflows are opaque; I want
  to see and tweak one agent") is solved by this plan. A multi-workflow runner is a solution
  looking for a second problem — and it would sit on parsers we have just established are
  best-effort (Axis A), a terrible foundation for anything that *executes*.

**Phased path:**

1. **Now (this plan):** inspector + per-agent edit brief + the ship guide gap. Ships the parse,
   the wire shape, and the seed-only edit loop.
2. **Next, if the inspector earns usage:** *run visibility, read-only* — surface a workflow run's
   progress by reading CLI-persisted run artifacts (the same disk-driven pattern as session
   history/token recovery, § History pagination). Gate it on verifying what each CLI actually
   persists per run (a research probe, `research/*.cjs` style) — unknown today, so it is advice,
   not scope.
3. **Later, only with evidence:** Builder-as-editor round-trip (open a parsed workflow in the
   canvas) — deferred by Axis B; the parse confidence contract built now tells us whether real
   scripts parse well enough to make that honest.

**Explicitly not recommended now:** an extension-hosted multi-workflow runner/scheduler (duplicates
the CLIs, violates thin-client), cross-format transpile (intent non-goal; formats are backend-native
— CLAUDE.md § Known limits), a freeform graph editor (ADR 0004 stands), and live run monitoring
(non-goal; belongs to phase 2 *only* as read-only artifact display, and only after the probe).

---

## Dispositions (survey Supersession table + new)

| Item | Disposition | Reason |
|---|---|---|
| 1. `hasDetail`/`detailPath` stamped suite-only (`src/skill-suite.ts:207-220`; fields `src/capabilities.ts:65-71`) | **COEXIST** | The field pair is the shared contract; there are now two *stampers* — `attachSuiteHowItWorks` for suite items (points at a bundle guide) and `capabilityFromWorkflowFile` for workflow items (points at the script itself). New code touching workflows uses the workflow stamp. One stamper is not enough because the two sources have different provenance and different read-authorization models (bundle name-allowlist vs. root containment), and criterion #6 keeps the suite mechanism alive on its own merits. |
| 2. `getCapabilityDetail`/`capabilityDetail` name-allowlisted to `SUITE_SKILL_NAMES` (`src/sidebar.ts:3505-3532`, `src/skill-suite.ts:227-235`) | **COEXIST** (extended, not replaced) | One message pair, two host branches keyed on the echoed host-stamped `detailKind` (`"workflow"` → path branch; anything else, including absent, → the shipped suite flow byte-for-byte — path presence is NOT the key, since suite items carry a `path` too). New workflow code uses the path branch with `resolveWorkflowDetailPath`; the suite name-allowlist branch ignores `path` entirely. One branch is not enough in either direction: the allowlist structurally cannot serve arbitrary paths (survey's own finding), and the path branch must never serve bundle guides (different roots, different content type, different cap semantics — refusal vs. truncated parse). |
| 3. `docs/grokbit-workflows.md` | **LEAVE** | Suite-scoped product doc ("the five bundled … workflows", `docs/grokbit-workflows.md:3`), orthogonal to User Workflows. It gains one consumer (Axis D's ship guide cites it, as the other five guides already do) but is not modified by this plan. |
| 4. Row `title` tooltip (`media/chat.js:812-814`) | **COEXIST** | Different interaction for a different moment: hover gives description+source at a glance on every kind; Details is click-to-expand deep structure on workflows/suite only. New code adds nothing to the tooltip and removes nothing from it. Two are needed because collapsing them means either losing at-a-glance info on non-detail kinds or making hover load file content. |
| *(new)* `capabilityDetail` markdown-only payload shape | **COEXIST** (superseded as *the only* shape, kept as a variant) | The message becomes a 3-way union; the markdown variant remains the suite tiles' live path. Webview code branches on payload fields (`workflow` vs `markdown` vs `error`), never on kind strings — consistent with the renderer's standing rule (`media/chat.js:805-807` *(opened this session)*). |
| *(new)* `grokbit-ship` "no Details button" state | **REPLACE** | Axis D1 authors the missing guide; the accidental no-affordance state is replaced by the same defined behavior the other five have. |

---

## Assumptions introduced by this design (each UNVERIFIED)

1. `UNVERIFIED` — The `agent(prompt, opts)` call shape (opts keys `label`, `phase`, `schema`,
   `model`, `effort`, `isolation`, `agentType`; helpers `parallel()`, `pipeline()`, `phase()`)
   matches what the CLIs actually save. The survey found **no real script on this machine** for
   either format; the shape rests on plan prose + test fixtures (survey Workflow file formats,
   final bullet). Mitigation is structural: Axis A3's degraded view means a shape mismatch degrades
   to "couldn't read the agent list," never a crash — but the *fixtures must be treated as the
   spec* until a real file is captured. A `research/`-style capture of a genuine saved workflow
   from each CLI is the verification step; flag for the Reviewer.
2. `UNVERIFIED` — Grok Rhai scripts use the same `agent("…", #{…})` two-arg convention with `#{`
   object maps. Entirely uncorroborated (survey: "presumably `agent(...)` calls — UNVERIFIED
   shape"). The Rhai arm of `parseAgentArgs` is written to the fixture shape and covered by the
   same degradation guarantee.
3. `RESOLVED` (Round 1) — `isPathContained` is exported (`export function`,
   `src/capabilities.ts:719-723`, verified by the reviewer and re-confirmed this session): no
   churn needed. `extractMetaStringField` remains the one private helper to export
   (`src/capabilities.ts:448`).
4. `RESOLVED` (by design revision) — the detail handler does not need to *reuse* the scan's root
   set; it recomputes it per call from the same inputs `listCapabilities` already derives per call
   (`sessionCwd(session)`, `HOME || USERPROFILE || os.homedir()`, `CAPABILITY_ROOTS[session.backend]`
   — `src/sidebar.ts:3419-3441` *(opened this session)*). The root-set policy (session backend
   only, `rootEnabled` honored, realpath'd host-side) is pinned in § New pure functions.
5. `UNVERIFIED` — 420px bounded scroll with per-agent collapse is adequate UX for realistic agent
   counts (~3–10). No real script exists to measure against; if real workflows routinely carry 20+
   agents, revisit Axis B's rejected overlay — the payload shape ports unchanged.

## Testing strategy

All new tests stay grok-free and claude-free (CI ≡ `npm test`, no binaries — survey Danger zones,
`.github/workflows/ci.yml`); the live suite (`npm run test:live`) is untouched by this feature.
Current floor to keep green: **1603 tests / 78 files** (survey Danger zones, measured this session).

1. **Pure parser tests — `test/workflow-inspect.test.ts`** (new, mirrors
   `test/capabilities.test.ts`'s fixture style at `:790-809`): happy-path Rhai + JS scripts with
   phases and multiple agents; adversarial cases the design promises to survive — braces/parens
   inside string literals, comments containing `agent(`, template-literal prompts with `${`}
   (→ `dynamic`), computed prompts, agent calls inside loops, a call with no opts object, opts with
   unknown keys, `schema` presence, `phase("…")` inference, a genuinely agent-free script
   (`agentCallSites: 0` — distinct shape from "sites found but opaque"), all-sites-opaque
   (`agentCallSites > 0`, agents `[]`), an oversized input (host-style
   `opts.truncated: true` passed in → stamped on the result), `WORKFLOW_AGENT_CAP`
   overflow (`overflowAgentCalls` counted separately, never added to `opaqueAgentCalls`), and
   `resolveWorkflowDetailPath` (inside root / outside root / symlink-escape via injected
   `realpath` / wrong extension / `.rhai` vs `.js` → format / **realpath ENOENT →
   `"read-failed"`, not `"not-a-workflow-path"`** / a root absent from `allowedRoots` — the
   host-side env-disabled / failed-realpath case — refused).
2. **Committed fixture files — `test/fixtures/workflows/*.{rhai,js}`** (new directory; committable,
   unlike the gitignored `.grok/`/`.claude/` — survey Workflow file formats). One realistic
   multi-phase script per format, used by parser tests and doubling as the in-repo reference
   example for developers (there is deliberately **no** user-facing sample generator — Craft with
   AI already generates workflows for users; adding a second generator serves no done criterion).
3. **View-model tests — extend `test/webview-helpers.test.ts`**: `workflowDetailView` (summary
   lines, the `emptyLine` honesty branch on `agentCallSites`, `opaqueLine` vs `overflowLine` kept
   distinct, `truncatedLine`, dynamic-prompt label, excerpt caps), `buildAgentEditBrief` (exact
   section composition, format line per backend, verbatim instruction, excerpt truncation,
   workspace-relative path), and `capabilityGroupsView` passing `detailKind` through.
4. **DOM tests — new `test/workflow-detail.dom.test.ts`** via `test/webview-harness.ts` (survey
   Reusable code): click Details on a workflow row → asserts `postMessage`
   `{type:"getCapabilityDetail", name, detailKind:"workflow", path}`; dispatch a
   `capabilityDetail` workflow payload → structured render, agent expand/collapse, prompt rendered
   via `textContent` (assert a `<script>`-looking prompt string lands inert); **propagation
   boundary (blocker guard)** — with the body open, a click on the body background and on the edit
   input leaves the composer unchanged and the popover open, while a click on the row head still
   seeds the invoke and closes the popover; edit-box + Draft button → composer contains the brief
   and **nothing was posted as a send**; Enter in the input drafts; empty input no-op;
   **draft-stash survival** — type into the input, dispatch a `setBusy` re-render, reopen the
   body → the typed text is restored, and a successful Draft clears the stash; both degraded
   payloads → the matching honest line (agent-free vs. couldn't-read), never blank; error payload
   → muted line; truncated notice; overflow footer distinct from opaque footer; detail-kind-aware
   button titles; **suite-tile regression** — a suite row's request carries `detailKind:"guide"`
   (no `path`), its markdown render is unchanged, and (declared behavior change) a click on the
   open guide's body text neither seeds the invoke nor closes the popover; locked row → disabled
   Details button.
5. **Guard-test hygiene:** run `test/chat-layout.dom.test.ts` unchanged — new classes must not
   appear in `getLauncherHtml`, no `@media` added, no new pixel-floored tracks (survey Danger
   zones). Extend `test/capabilities.test.ts` for the `capabilityFromWorkflowFile` stamp
   (`hasDetail`/`detailPath`/`detailKind:"workflow"` present on workflow items, absent on nothing
   else new) and `test/skill-suite.test.ts` for `attachSuiteHowItWorks` now stamping
   `detailKind:"guide"`.
6. **Axis D:** a small existence-style test is unnecessary — `attachSuiteHowItWorks` is
   existence-driven (`src/skill-suite.ts:216-218` *(opened this session)*) and already covered;
   the guide file's presence is verified by the existing suite tests picking it up, plus
   `npx @vscode/vsce ls` at package time (CLAUDE.md § Grokbit Actions verification idiom).
