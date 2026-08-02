# Review log — Session tab scroll position restore

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

Spot-checked against live sources: `media/chat.js` (stick/scroll/reset/force paths), `media/webview-helpers.js` (`shouldStickToBottom`), `src/panel-router.ts` (`replayInto`/`markReady`/`postTo`), `src/sidebar.ts` (`ready`, `replayInto`, `postPanelConfig`, `startSession`, clear emit sites), `src/session.ts` (buffer/ready; no scroll fields).

### Grounding
Citations largely hold. One miss:

- `[MINOR]` Survey entity table claims messages scroll container HTML at `src/sidebar.ts:4805` — evidence: `#messages` is at `src/sidebar.ts:4792`; line 4805 is the scroll-to-bottom button. Scroll APIs at `media/chat.js:4226–4268`, ready at `2727–2735`, `retainContextWhenHidden:false` at `712–717`, `PanelRouter.replayInto` at `100–106`, and unconditional `state.stickToBottom = true` at `media/chat.js:2692` are accurate.

### Findings

- `[BLOCKER]` Design gates only `scrollToBottom()` during panel replay; buffer replay still calls `forceScrollToBottom()` on every buffered `userMessage` and on live `permissionRequest` / `questionRequest` cards — evidence: `media/chat.js:5486` (`case "userMessage"`), `4396` (`addPermissionCard`), `4532` (`addQuestionCard`); design § “Uniform rule” only says `panelReplaying → scrollToBottom() no-ops` and unhappy path explicitly keeps `forceScrollToBottom` **not** gated by `panelReplaying`. On a multi-turn buffer that means N force-pins mid-rebuild (set `stickToBottom = true` + jump `scrollTop` to max) before `endPanelReplay` tries to undo them. Resolves by: while `state.panelReplaying`, no-op **both** `scrollToBottom` and `forceScrollToBottom` (interactive force remains for live post-end events only); document that pending permission/question cards that only exist in the buffer restore under mid-scroll policy (intent assumption) and do not force-pin during reveal rebuild.

- `[BLOCKER]` Continuous `scrollState` posts from the scroll listener / force path will corrupt host memory **during** reveal replay unless suppressed — evidence: design requires posting `scrollState` from `#messages` scroll listener (`media/chat.js:4251–4261`) and on `forceScrollToBottom`; force/userMessage paths above fire during buffer replay and will synthesize “pinned at bottom” metrics; host assigns onto `Session` with “last write wins.” A mid-scroll user who switches away then back can have host `scrollStickToBottom` flipped true mid-replay; if they hide again before `endPanelReplay`’s corrective post (or if end is dropped / ordered wrong), the next restore pins to bottom and fails done-criteria 1 and 4. Resolves by: do not post `scrollState` while `panelReplaying` (and ideally while applying restore); only host-authoritative updates after `endPanelReplay` (plus normal live scroll).

- `[BLOCKER]` Scroll-memory clear is underspecified and will bleed across restarts on the same `Session` — evidence: design § Shape step 5 only says clear on “new tab / backend switch that clears history” / “paths that `emit(clearMessages)`”; live `startSession` always does `session.buffer = []` (`src/sidebar.ts:2077`) for **every** restart/resume/backend flip, but `emit({type:"clearMessages"})` only runs for resume (`2113`) and restart-clear (`2011`). Effort/model restart, summarize-restart, and `switchBackend` (`600–631` → `startSession` without prior clear emit) keep the same `Session` object. Leaving `scrollTop` / `scrollStickToBottom` set after a conversation reset means the next hide→reveal restores the **previous** conversation’s mid-scroll onto a new/empty thread. Resolves by: reset scroll fields in `startSession` (same choke point as `buffer = []`), plus any intentional live `clearMessages` that is not a panel-reveal wrap; list those call sites explicitly in the design.

- `[MAJOR]` Design text contradicts itself on wire shape and ordering; implementer can ship the broken intermediate plan — evidence: `03-design.md` first specifies only a trailing derived `{type:"restoreScroll"}` after buffer (`57–66`), then says clearMessages must somehow know a restore is coming (`69–71`), then pivots to `beginPanelReplay` **before** `clearMessages` (`75–116`). Survey danger zone correctly says reveal and intentional clear must be distinguished; only the begin/end (or equivalent before-clear) approach does that. Leaving both recipes in “Shape of the change” invites implementing trailing-only restore while `resetForNewSession` still pins (`media/chat.js:2692`) and intermediate `scrollToBottom`/`forceScroll` yank. Resolves by: delete/supersede the trailing-only `restoreScroll` recipe; lock one sequence: `markReady` → `postPanelConfig` (existing) → `beginPanelReplay` → `router.replayInto` (clear + buffer + mode/chips/backend) → `endPanelReplay` (apply restore). Note `ready` already does config **between** markReady and replay (`sidebar.ts:2733–2735`); begin must sit with/after config and **before** clear, not replace that fact.

- `[MAJOR]` Debounced `scrollState` can miss the last position on fast tab switch — evidence: design proposes ~50–100ms debounce on the scroll listener; primary user path is “scroll mid → click another editor tab.” `markHidden` runs on hide (`sidebar.ts:749–756`) and the webview is torn down (`retainContextWhenHidden:false`); there is no guaranteed final scroll event, and current `visibilitychange` only closes popovers (`media/chat.js:6052–6054`). A debounced post can be lost → host retains older pin/offset → done-criterion 1 fails intermittently. Resolves by: flush latest metrics immediately on `visibilitychange` (document.hidden) and/or on `forceScrollToBottom` / scroll-button pin (already proposed) **without** waiting for debounce; keep debounce only for high-frequency mid-scroll updates while visible.

- `[MAJOR]` `resetForNewSession` still unconditionally sets `stickToBottom = true` (`media/chat.js:2692`); design disposition says REPLACE but does not specify the exact gate relative to `beginPanelReplay` — evidence: reveal path is always `clearMessages` → `resetForNewSession` (`5763–5765`); if begin only sets `panelReplaying` and reset re-pins stick, intermediate logic that keys off stick (not only `panelReplaying`) still misbehaves; intentional live clears must still pin. Resolves by: in `resetForNewSession`, if `state.panelReplaying` (or pending restore from begin), do **not** force stick true / do not call behavior that fights end restore; else keep today’s pin. State that `panelReplaying` is set only by begin and cleared only by end (with a safety clear on intentional non-replay paths if begin never arrived).

- `[MAJOR]` `historyReplay` vs panel reveal is mostly separated, but risk of overloading `state.replaying` is not hard-ruled — evidence: `state.replaying` is exclusively session/load bracketing (`media/chat.js:5521–5534`, host `sidebar.ts:2527–2544`); it already changes tool/thought/UI behavior. Design correctly says leave historyReplay as-is for resume pin, but never forbids reusing `state.replaying` for panel rebuild. Resolves by: mandate a **distinct** flag (`panelReplaying` / pending restore), never reuse `state.replaying`; note resume may still later hide→reveal and then use host scroll memory (after user scrolled).

- `[MAJOR]` Done-criterion 6 (“permission/question force-scroll on a **visible** tab”) vs restore-while-hidden assumption needs an explicit post-end rule — evidence: intent assumption line 39 + design unhappy path; after `endPanelReplay` restores mid-scroll, a **still-pending** permission card is in the DOM but may be off-screen (by design for v1). If implementers “fix” that by calling `forceScrollToBottom` once at end whenever a pending card exists, they violate done-criterion 4 / the assumption. Resolves by: state explicitly — end restore wins; do not scan for pending cards and force-pin after reveal; live **new** permission/question after end still force-scroll.

- `[MINOR]` Optional pure `clampScrollTop` is fine; do not reimplement `shouldStickToBottom` — survey reusable section is correct (`media/webview-helpers.js:168–172`). Design follows this; keep tests extending existing stick helpers rather than a second near-bottom predicate.

- `[MINOR]` Async layout after end (images / Mermaid / MathJax) can change `scrollHeight` after `scrollTop` is applied; absolute restore will drift. Acceptable under intent assumptions, but worth one sentence so QA does not treat media-heavy threads as a hard failure.

- `[MINOR]` `postTo` after `markReady` for begin is sound (`panel-router.ts:83–85`, ready order `2733–2735`); prefer the same delivery path as `router.replayInto` (bound port) so begin cannot diverge if someone later moves markReady. Not a current bug if markReady stays first.

- `[MINOR]` Supersession dispositions are present (REPLACE / REPLACE behavior / LEAVE gap) and match the survey table — no undeclared supersession. Good.

- `[MINOR]` Verifiability: human done-criteria 1–7 are observable; proposed DOM tests cover pin vs mid and “scrollToBottom no-op during panel replay” but not forceScroll suppression, scrollState suppression, debounce/visibility flush, or startSession memory clear — add those to the test list or they will regress.

### Intent drift
- Non-goals respected: no `retainContextWhenHidden: true` primary fix; no launcher/popover scroll scope; window-reload persistence optional.
- Option A matches constraints; B correctly rejected.
- No major scope inflation beyond host↔webview scroll protocol required by A.

### Reinvention
- Plan correctly reuses `shouldStickToBottom`, `scrollToBottom` gate, `forceScrollToBottom`, and reveal replay — not a second stick system. Risk is incomplete gating of the existing force path, not a parallel stack.

### postTo / begin-before-clear (checkpoint)
- **begin before clear:** Required and correctly identified; `PanelRouter.replayInto` always starts with `clearMessages` (`panel-router.ts:103`). Host wrap that posts begin **before** `this.router.replayInto(...)` is valid; folding begin into derived-after-clear is **not**.
- **markReady then begin then replay:** Works with current ready handler if begin is inserted in `GrokSidebar.replayInto` (called after markReady). `postPanelConfig` already runs first; begin must not depend on being the first message ever, only on preceding clear.

### Session dispose / new-session scroll bleed (checkpoint)
- Panel close + new `Session` is fine (fields die with the object).
- Same-session `startSession` without clearing scroll fields is the bleed path (see BLOCKER above).

## Outcome (after Round 1)
Rounds used: 1 of 3  
Outstanding at exit: all BLOCKER/MAJOR listed above — pending Architect revision.

### Architect response — Round 1
- `[BLOCKER]` forceScroll during replay → **REVISED**: while `panelReplaying`, no-op **both** `scrollToBottom` and `forceScrollToBottom`; end restore wins; no pending-card force at end.
- `[BLOCKER]` scrollState corrupts host during replay → **REVISED**: never post `scrollState` while `panelReplaying`; one authoritative post after end; scroll listener suppresses apply-induced events.
- `[BLOCKER]` scroll bleed across startSession → **REVISED**: reset `scrollStickToBottom=true`, `scrollTop=0` in `startSession` alongside `buffer = []`; reveal clear does not clear host memory.
- `[MAJOR]` contradictory wire recipes → **REVISED**: single locked sequence only (begin → clear+buffer+derived → end); trailing-only `restoreScroll` deleted from design.
- `[MAJOR]` debounce miss on fast switch → **REVISED**: immediate flush on `visibilitychange` / `document.hidden`; debounce only for live mid-scroll.
- `[MAJOR]` resetForNewSession gate → **REVISED**: if `panelReplaying`, do not force stick true; else pin as today.
- `[MAJOR]` reusing `state.replaying` → **REVISED**: mandate distinct `panelReplaying`; never reuse historyReplay flag.
- `[MAJOR]` force after end for pending cards → **REVISED**: end restore wins; live new cards after end still force.
- `[MINOR]` citation line #messages → acknowledged; not design-blocking.
- `[MINOR]` async layout drift → documented as acceptable QA note.
- `[MINOR]` test list gaps → expanded required coverage (force no-op, scrollState suppress, visibility flush, startSession reset).

## Round 2
Reviewed: revised `03-design.md` vs Round 1 outstanding items

Spot-checked again: `media/chat.js` (`resetForNewSession`/`scrollToBottom`/`forceScrollToBottom`/scroll listener/`visibilitychange`/userMessage+permission force sites), `src/sidebar.ts` (`ready` order 2727–2735, `startSession` 2073–2113, `emit(clearMessages)` only at 2011 + 2113, `GrokSidebar.replayInto` 4366–4371), `src/panel-router.ts` (`replayInto` clear-first, `postTo` ready gate), `src/session.ts` (no scroll fields yet).

### Round 1 BLOCKER/MAJOR disposition

| Item | Status | Evidence in revised design |
|---|---|---|
| **[BLOCKER]** forceScroll during buffer replay | **FIXED** | § Webview `panelReplaying`: while true, **both** `scrollToBottom()` and `forceScrollToBottom()` are full no-ops; buffered userMessage/permission/question called out; “End restore wins” forbids post-end pending-card force-pin. Live force after end retained. Matches live force sites (`media/chat.js:5486`, `4396`, `4532`). |
| **[BLOCKER]** scrollState corrupts host mid-replay | **FIXED** | Never post `scrollState` while `panelReplaying`; scroll listener debounced only when not replaying; end posts one authoritative `scrollState`; apply-induced scroll events must be suppressed. Unhappy path “Rapid re-hide mid-replay → host memory unchanged until end.” |
| **[BLOCKER]** scroll bleed across same-`Session` restart | **FIXED** | Anti-bleed: reset `scrollStickToBottom=true`, `scrollTop=0` in **`startSession`** beside `buffer = []` (`~2077`). Explicitly covers effort/model, summarize-restart, backend switch, resume, fresh spawn. Reveal clear must **not** clear host memory. Known `emit(clearMessages)` sites (~2011 restart-clear, ~2113 resume) both sit on the startSession path (spot-check confirms only those two host emits). “Audit at implement” is soft but not residual risk given the choke point + listed sites. |
| **[MAJOR]** contradictory wire recipes | **FIXED** | Single locked sequence only (`markReady` → `postPanelConfig` → **begin** → `router.replayInto` → **end`). Canonical site `GrokSidebar.replayInto`. Explicit “Do **not** implement a trailing-only `restoreScroll` without begin/end.” Trailing-only recipe removed from Shape. |
| **[MAJOR]** debounce miss on fast tab switch | **FIXED** | Immediate flush (no debounce) on `document.visibilitychange` when `document.hidden`; force/scroll-button pin also flush live. Debounce only for mid-scroll while visible + `!panelReplaying`. |
| **[MAJOR]** `resetForNewSession` unconditional stick | **FIXED** | If `panelReplaying`, do **not** force `stickToBottom = true`; else keep today’s pin. Combined with dual scroll-helper no-ops, rebuild cannot re-pin mid-scroll even if initial webview stick defaults to true (`media/chat.js:233`). |
| **[MAJOR]** overload `state.replaying` | **FIXED** | Mandate distinct `panelReplaying`; “**Never** reuse `state.replaying`”; historyReplay remains session/load-only (`5521–5534`). |
| **[MAJOR]** post-end force for pending cards | **FIXED** | “End restore wins”; do not scan pending permission/question after reveal; live **new** cards after end still force. Aligns intent assumption (hidden-tab card) + done-criteria 4/6. |

### New findings (revision-induced or residual)

- `[MINOR]` Host wrap should use **try/finally** so `endPanelReplay` still posts if anything between begin and end throws while the tab stays visible — otherwise `panelReplaying` sticks true until the next tear-down (force/scrollState dead for that paint). Design assumes clean host path; add one implement sentence.
- `[MINOR]` Wording “leave false / pending” under `resetForNewSession` is slightly imprecise: a fresh post-tear-down webview has `stickToBottom: true` by default. Harmless because `panelReplaying` no-ops both scroll helpers; implementers must not read “leave false” as “set false.” Prefer: “do not force pin; leave stick unchanged until end.”
- `[MINOR]` Suppress window for apply-induced scroll events should cover through the authoritative end `scrollState` post (not only the `scrollTop` write), so a deferred listener tick cannot race last-write on the host. Design already gestures at this; keep suppress until after that post.
- `[MINOR]` `visibilitychange` flush can still race VS Code webview dispose under `retainContextWhenHidden:false`. Acceptable residual: continuous debounced posts while visible cover common cases; flush is best-effort last write. Matches existing product use of `visibilitychange` for popovers (`media/chat.js:6052–6054`).
- `[MINOR]` Initialize `state.panelReplaying = false` (and clear any `pendingRestore`) on the webview `state` bag — design defines begin/end transitions but not cold defaults.
- `[MINOR]` Survey entity table still cites `#messages` at `sidebar.ts:4805` (scroll-to-bottom button); actual id is earlier (~4792). Non-blocking for implementation.

### Grounding / intent / reinvention (Round 2)
- Locked sequence matches live `ready` order and `PanelRouter.replayInto` clear-first contract.
- No reinvention of stick policy; reuses `shouldStickToBottom`; gates existing helpers.
- Non-goals still held (no `retainContextWhenHidden: true` primary fix; no launcher/popover scope; window-reload optional).
- Required tests now cover force no-op, scrollState suppress, visibility flush, startSession reset — Round 1 MINOR test-gap addressed.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: **none** (0 BLOCKER, 0 MAJOR)

**Plan review Approve.** Loop 3 is not required; implement may proceed from durable plan + this log once Lead routes `/implement`.

## Plan review (Loop 4)
Reviewed: plan.md

Checked against: `01-intent.md` (done criteria 1–7), `03-design.md` (disposition + locked sequence), `assumptions.md`, task field checklist (verify/cwd/files/depends/baseline/removes/rollback/state-after), runnable `npm test` verifies, matrix completeness, disposition parity, intent-proving verifies, per-task working tree.

### Checklist

| Check | Result |
|---|---|
| Every task has verify/cwd/files/depends/baseline/removes/rollback/state-after | **PASS** — T1–T5 all present (`cwd: none`) |
| Every verify command is runnable from repo root | **PASS with note** — all use `npm test -- …`; new files are created by their tasks. T4’s host begin/end proof is not a single named file (see MAJOR) |
| Verification matrix covers every done-criterion | **PASS** — all 7 rows map to T3/T4/T5 and/or existing #16 / baseline tests |
| Disposition summary matches `03-design.md` | **PASS** — REPLACE×2 (stick-on-reset; force-to-bottom during reveal), LEAVE×1 (host scroll gap); DEPRECATE/COEXIST 0 |
| Every task verify proves its intent | **FAIL (T4)** — see MAJOR below; T1 soft optional pure path is MINOR |
| Task order leaves repo working where claimed | **PASS** — T1/T2 additive; T3 without T4 leaves `panelReplaying` false so pin behavior unchanged; unknown `scrollState` is a no-op switch miss (no default throw); T4 completes wire; T5 suite |

### Findings

- `[MAJOR]` **T4 verify does not lock a concrete proof that the host posts begin/end.** Intent is the locked wire: `beginPanelReplay` → `router.replayInto` (clear+buffer+derived) → `endPanelReplay`. The named commands (`test/panel-router.test.ts`, `test/electron-lifecycle.pure.test.ts`, `test/tab-scroll-restore.dom.test.ts`) do **not** exercise `GrokSidebar.replayInto` — panel-router is intentionally signature-unchanged; electron-lifecycle only mocks clear→buffer; DOM tests inject begin/end themselves and stay green if the host never posts them. The clause “plus a host-level or harness test … (source-order assertion or router-port mock **if available**)” is not a single runnable verify path and the “if available” hedge can be skipped. Full `npm test` also stays green without the wrap. Resolves by: name a required test file (e.g. `test/sidebar-scroll-replay.test.ts` or a source-order check of `src/sidebar.ts` that fails unless begin is posted before `this.router.replayInto` and end after, with try/finally) and put that path first in T4’s `verify:` with no optional hedge. Keep full-suite smoke as secondary.

- `[MINOR]` **T1 verify is pure-helper-centric while pure extract is optional.** Intent includes `startSession` reset and `scrollState` onMessage. Verify asserts defaults/coerce/reset/pick helpers; files say “optionally `src/session-scroll.ts`”. A pure-only green run does not fail if `startSession` never calls reset (Round 1 scroll-bleed risk). Resolves by: lock one verify file and either (a) require pure helpers as the only Session-scroll API and assert call-site wiring via source-order/import, or (b) include Session field defaults + a small pure `applyScrollState`/`resetSessionScrollMemory` that sidebar must use.

- `[MINOR]` **T3 verify omits the positive force-scroll case for done-criterion 6.** It requires force **no-op** while `panelReplaying` but not “force still works when `!panelReplaying`.” Matrix claims baseline permission DOM tests; name that file in T3 verify or add one post-end force case so criterion 6 is not only implicit.

- `[MINOR]` **Fuzzy verify filenames** — T1 “or the chosen test file”, T3 “or the file that holds the new cases”, T4 “adjust names”. Prefer locked paths before implement so Done parsing is unambiguous.

- `[MINOR]` **T5 manual checklist is optional in task body** while the matrix relies on T5 manual for criteria 1–4. `assumptions.md` already records human-only multi-tab hide/reveal — sufficient; optional to add a 4-bullet checklist under T5 notes or assumptions Resolution. Non-blocking.

### Disposition / matrix / order (no issues)

- Design dispositions carried: unconditional stick-on-reset → T3 REPLACE; implicit force-to-bottom during reveal → T3 REPLACE; host memory gap → T1 LEAVE/add. No dropped supersession.
- Matrix rows 1–7 cover intent done-criteria; criteria 1–4 correctly admit automated mechanism + manual multi-tab (cannot drive VS Code editor-tab hide/reveal in grok-free suite).
- Per-task `state-after: working` holds under the dependency graph (T2∥T1 → T3 → T4 → T5).

### Architect response
- `[MAJOR]` T4 verify soft → **REVISED**: locked `test/panel-replay-scroll.test.ts` with required order + try/finally source/unit proofs; no optional hedge.
- `[MINOR]` T1 optional pure → **REVISED**: required `src/session-scroll.ts` + `test/session-scroll.test.ts` + startSession call-site source check.
- `[MINOR]` T3 missing positive force → **REVISED**: case (4) force works after end when `!panelReplaying`.
- `[MINOR]` fuzzy filenames → **REVISED**: locked test paths.
- `[MINOR]` T5 checklist → acknowledged; assumptions.md already covers human-only multi-tab.

Outcome: revised — re-check clean for gate
