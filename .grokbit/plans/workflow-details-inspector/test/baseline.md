# Baseline — workflow-details-inspector

Captured BEFORE implementation at commit `7d5e5a4` on 2026-08-03, against a green
tree (`npm test` → 78 files / 1603 tests passing, `npx tsc -p . --noEmit` clean).

Records what the system does TODAY. Not what it should do. Where current behavior
is arguably wrong — B1.4 below — the wrong behavior is asserted exactly as
observed, because this is an instrument for detecting change, not for judging
correctness.

**Characterization suite:** `test/workflow-details.baseline.ts` — 21 tests, all
green at capture time (`npm run test:baseline`).

**Why it is `*.baseline.ts` and not `*.test.ts`.** Several of these tests are
expected to go red once the plan lands, and the plan says so in writing. Left in
`npm test` they would fail every implement task's own `verify:` command, so the
baseline would break the machine it exists to measure. The file therefore follows
the repo's existing opt-in idiom (`vitest.perf.config.ts` / `test/*.perf.ts`,
deliberately outside `npm test` and CI): new `vitest.baseline.config.ts` matching
`test/**/*.baseline.ts`, new `npm run test:baseline` script. Verified after
adding it that `npm test` is still exactly 78 files / 1603 tests.

**Recommendation for Implement:** run `npm run test:baseline` after T5, T6, T8 and
T9 — the four tasks with declared behavior changes — so each difference is seen
when it is introduced rather than all at once at verify time. It costs ~1s.

## Captured behaviors

### B1 — capability-row click behavior (plan T5 baseline)

Path exercised: real `media/chat.js` `buildCapabilityRow` in happy-dom via
`test/webview-harness.ts`, driven by a `{type:"capabilities"}` message carrying a
suite item stamped `hasDetail: true` + `detailPath`, exactly as
`attachSuiteHowItWorks` stamps it today.

| ID | Input | Observed output |
|---|---|---|
| B1.1 | render a `hasDetail` row | `.capability-row-detail-wrap` containing `button.capability-row-details`, text `"Details"`, `title="How this workflow works (roles, loops, caps)"`; after opening, `aria-expanded="true"` |
| B1.2 | click Details | posts exactly `{type:"getCapabilityDetail", name:"grokbit-explore"}` — key set is precisely `["name","type"]`; **no `path`, no `detailKind`** |
| B1.3 | click Details | composer stays `""` (the button's own `stopPropagation`, `media/chat.js:872-873`, holds) |
| **B1.4** | click **inside the opened detail body** | **composer becomes `"/grokbit-explore "`** — there is no propagation boundary on the wrap or the body, so the click reaches `row.onclick` (`media/chat.js:922-926`) and replaces the composer contents |
| B1.5 | same click, in the Actions popover mount | popover `hidden` flips to `true` — `closePopovers()` also runs |
| B1.6 | click "Open in editor" | posts `{type:"openFile", path:"<detailPath>"}`; `title="Open the full how-it-works guide as a file"`; composer stays `""` |
| B1.7 | `setBusy: true` then render | row carries `locked`; Details button `disabled === true`; **no** "Open in editor" button rendered at all |

B1.4 and B1.5 are the latent defect `03-design.md` § UI structure declares this
change fixes. Recorded here as it actually behaves so the fix is provable rather
than asserted.

### B2 — capabilityDetail render (plan T6 baseline)

Path exercised: the `case "capabilityDetail"` handler, `media/chat.js:6096-6119`.

| ID | Input | Observed output |
|---|---|---|
| B2.1 | open Details, no reply yet | body visible, `textContent === "Loading…"` |
| B2.2 | `{markdown:"## Purpose\n\nRead-only orientation."}` | rendered through `renderMarkdown`; text contains "Purpose" and "Read-only orientation"; `innerHTML` does **not** contain the raw `## Purpose` source |
| B2.3 | `{error:"not-a-suite-skill"}` | `"No guide for this item."` |
| B2.3 | `{error:"too-large"}` | `"Guide is too large to show here — use Open in editor."` |
| B2.3 | `{error:"not-found"}` | `"Could not load the guide."` |
| B2.3 | `{error:"read-failed"}` | `"Could not load the guide."` |
| B2.4 | reply with a non-matching `name` | ignored — body still `"Loading…"` (correlation is by `name` alone) |
| B2.5 | second Details click | body `hidden === true`, `textContent === ""`, `aria-expanded="false"` |

### B3 — seed-only composer contract (plan T7 baseline)

| ID | Input | Observed output |
|---|---|---|
| B3.1 | click a User Workflow row | composer `=== "/workflow review-changes "`; **`posted` is empty** — nothing is sent, nothing is even requested |
| B3.2 | click row Alpha, then row Beta | composer `=== "/workflow beta "` — replace, not append (`mode:"replace"`, `media/chat.js:922-926`) |

### B4 — User Workflow tiles carry no detail affordance (plan T8 baseline)

| ID | Input | Observed output |
|---|---|---|
| B4.1 | `capabilityFromWorkflowFile` on a real-shaped Rhai head with `phases:` and an `agent(...)` call | item key set is exactly `["description","invoke","kind","name","origin","path","source"]` — `hasDetail`/`detailPath` `undefined`, and **no structural data at all**: the meta `phases` array and the `agent(...)` call are both parsed past |
| B4.2 | render a workflow group | the `Review Changes` row has `data-kind="workflow"`, a `/workflow` command chip, and **no** `.capability-row-details` / `.capability-row-detail-wrap` |
| B4.3 | render a workflow group | a synthetic **"Create Workflow"** tile is **prepended** — rendered labels are `["Create Workflow","Review Changes"]`; clicking it opens the `#workflow-builder` overlay, seeds nothing, posts nothing |

B4.3 is an adjacent behavior found while capturing B3 (Loop T1 step 4) and it is
load-bearing for this change: the Create tile is the *first* `.capability-row` in
every workflow group and is not file-backed, so a Details affordance stamped onto
"every workflow row" must not attach to it. It is also why the characterization
suite looks rows up by display label rather than by `querySelector`.

### B5 — bundled guide inventory on disk (plan T9 baseline)

| ID | Input | Observed output |
|---|---|---|
| B5.1 | `existsSync` over `resources/skills/<name>/references/how-it-works.md` for all six `SUITE_SKILL_NAMES` | missing set is exactly `["grokbit-ship"]` |
| B5.2 | `attachSuiteHowItWorks` against the real bundle root | stamps exactly `["grokbit-explore","grokbit-plan","grokbit-implement","grokbit-test","grokbit-document"]`; `grokbit-ship.hasDetail === undefined` |

### B6 — host-side detail resolution (plan T4b baseline)

| ID | Input | Observed output |
|---|---|---|
| B6.1 | `resolveSuiteHowItWorksPath("/ext", <a file path>)` for a `.rhai` path, a Windows `.js` path, and `../../etc/passwd` | all three → `{ok:false, error:"not-a-suite-skill"}` — the shipped endpoint structurally cannot serve an arbitrary path |
| B6.2 | the same for each of the six suite names | all six resolve `ok`, path `=== suiteHowItWorksPath(EXT, name)` — **including `grokbit-ship`, whose guide file does not exist** |

B6.2 records a real dead branch: `getCapabilityDetail("grokbit-ship")` would
resolve, then fail at `statSync` and reply `error:"not-found"` → the webview would
show *"Could not load the guide."* It is unreachable today only because B5.1 means
that tile never renders a Details button to click.

## Visual captures

None. No headless-browser capture was taken and none is claimed: this UI is a VS
Code webview, the repo has no `@vscode/test-electron` suite (CLAUDE.md § What's
next, item 1), and happy-dom performs no layout. Structure and behavior are
captured above; **pixels are not**. See NOT CAPTURED for the specific consequence.

## NOT CAPTURED

These cannot be regression-checked from this baseline. The verify run must say so
rather than letting silence imply safety.

- **The host `getCapabilityDetail` read branch end to end** (`src/sidebar.ts:3505-3532`) — `statSync` / `isFile` / the 64KB `HOW_IT_WORKS_MAX_BYTES` cap / `readFileSync` / the `postTo` assembly. Reason: it is a private method on `GrokSidebar`, which requires `vscode`; the repo has no harness that instantiates it, and `npm test` is deliberately vscode-free. Its *pure* edges are captured (B6, and `resolveSuiteHowItWorksPath`/`attachSuiteHowItWorks` in the existing `test/skill-suite.test.ts`). This gap is closed by the plan itself — T4a extracts exactly this branch behind an injected-fs port precisely because it is untestable today.
- **Parsing against a genuine saved workflow script.** No real `.grok/workflows/*.rhai` or `.claude/workflows/*.js` exists anywhere on this machine (survey § Absences; assumptions A5/A6). B4.1 characterizes the parser against the *fixture* shape, which is the spec until a real file is captured. A verify run cannot claim the parser handles real scripts, only that it still handles the fixture identically.
- **Rendered geometry.** `.capability-row-detail-body { max-height: 220px }` and the plan's proposed 420px `.workflow-detail` bound are CSS; happy-dom does no layout, so no before/after measurement exists. Assumption A7 (is 420px adequate for realistic agent counts) cannot be settled by this baseline or by the verify run — only by looking at it.
- **The composed `grokbit-ship` → `not-found` host reply.** B6.2 captures both halves separately (resolver succeeds; file absent) but never executes the host method that joins them, for the same reason as the first bullet.
- **Live VS Code behavior** — real `postTo` delivery, panel replay, the four-anchor lifecycle in a real webview. Same absent-harness reason; unchanged from every other feature in this repo.

## Expected movement at verify time

Design-derived expectation, **not** captured data — recorded so Step 1 can classify
quickly, not to pre-classify. Each still requires its own `03-design.md` citation
at verify time, and any difference not listed here is `UNKNOWN` until argued.

| Expected to flip | Because |
|---|---|
| B1.1 (button `title`) | T5 makes the two detail-button titles detail-kind-aware |
| B1.2 (exact request keys) | T5 adds `detailKind` and `path` to the request |
| B1.4, B1.5 (body click escapes) | T5's `.capability-row-detail-wrap` propagation boundary — the declared, intended fix |
| B4.1, B4.2 (workflows have no detail) | T8 stamps `hasDetail`/`detailPath`/`detailKind` on workflow items |
| B5.1, B5.2, B6.2's last assertion | T9 authors the missing `grokbit-ship` guide |

| Expected to stay green (true regression guards) | |
|---|---|
| B1.3, B1.6, B1.7 | button `stopPropagation`, openFile payload, locked-state handling |
| B2.1–B2.5 | the suite markdown path and every error sentence must survive the 3-way payload union |
| B3.1, B3.2 | the seed-only contract — nothing auto-sends, replace not append |
| B4.3 | the synthetic Create Workflow tile must not gain a Details affordance |
| B6.1 | the suite resolver must keep refusing arbitrary paths |
