# Review log — Grokbit Actions: workflows only, as readable tiles

Append-only. Loop 3 (adversarial, design) then Loop 4 (plan-level, single pass).

---

## Round 1 — adversarial review of `03-design.md`

Citations spot-checked by opening the cited files. `media/chat.js:1007`
(`sessionToggleGroup` appended directly, bypassing `capabilityGroupsView`),
`src/skill-suite.ts:160` (`source: "Grokbit"`), `media/chat.js:973`/`:1024`
(empty state computed from `viewGroups.length` before `appendCapabilityGroups`)
and `media/chat.css:1821`–`1822` (the no-`@media` rule) all say what the design
claims. The measured truncation figures in Decision 2 were re-derived
independently and match.

### `[BLOCKER]` R1-1 — putting the filter inside `capabilityGroupsView` breaks ~20 existing unit tests and voids the builder's contract

**Evidence:** every test in the `capabilityGroupsView` describe block
(`test/webview-helpers.test.ts:895`–`1210`) constructs groups of
`kind: "skill" | "agent" | "command"` — e.g. `:924` "truncates a long
description" uses `kind: "command"`, `:1001` "truncates a long hint" uses
`kind: "skill"`. With a `["grokbit"]` allowlist applied inside the builder, each
returns `[]` and every `v[0].items[0]` dereference throws a TypeError. That is
not a handful of assertions to update, it is the builder's entire unit-test
surface deleted — including the coverage for `action`/`inert` resolution,
`label`/`invokeLabel`, hint handling, and the featured partition, none of which
this change is supposed to alter.

The design also acknowledged (Decision 1, "Also costs") that the builder's own
documented contract — "iterates the supplied groups ARRAY in the order given —
no fixed keys, no three-kind branching" (`media/webview-helpers.js:713`–`718`) —
would have to be amended. Amending a contract to accommodate a filter is a
signal the filter does not belong there.

**What would resolve it:** keep `capabilityGroupsView` exactly as it is, and add
the allowlist as a **separate exported pure function**
(`visibleCapabilityGroups(groups)`) applied by the two mounts before they call
the builder — `media/chat.js:972` and `:1023`. Two one-line call sites instead
of one, but: zero existing unit tests break, the generic contract stays true, the
filter gets its own small focused test, and a missed call site fails an existing
DOM test rather than passing silently. The Session-controls group still cannot
be affected — it never reaches either call site.

### `[BLOCKER]` R1-2 — `-webkit-line-clamp: 4` visually re-truncates the copy the change exists to make readable

**Evidence:** `01-intent.md` done-criterion 4 requires each description to read
as complete sentences and never end mid-sentence. Decision 2 raises the trim to
260 characters and Decision 3 then clamps the rendered description to 4 lines.
At the proposed 300px min track (`.capability-group-items`) and the existing
11px `.capability-row-desc` font size (`media/chat.css:2036`), four lines holds
roughly 180 characters. grokbit-plan's trimmed description is 252. The tile
would render an ellipsis mid-sentence — the exact defect being fixed, moved from
the data layer to the CSS layer where no test can see it.

**What would resolve it:** drop the line clamp entirely. There are four tiles;
they cannot become a wall of text. The `auto-fit` grid already equalises row
heights, so the tallest tile sets the row and the layout stays tidy without a
clamp.

### `[MAJOR]` R1-3 — the test blast radius is understated by roughly an order of magnitude

**Evidence:** the design's disposition table says the featured/expand test block
is "retargeted onto an oversized `grokbit` fixture", as if that were the extent
of it. It is not. In `test/capabilities.dom.test.ts` alone the following feed
`skill`/`agent`/`command` groups and assert rendered rows or headings, and all
break: `:117` (asserts `["Agents","Commands","Skills"]`), `:129`, `:138`,
`:147`, `:167`, `:188`, `:206`, `:223`, `:238`, `:262`, `:276`, `:394`, `:571`
(asserts `titles` contains `"Skills"`), `:675`–`:683` (asserts exactly 3 rows),
and the whole featured/expand block at `:790`–`:860`. Plus the
`capabilityGroupsView` block in `test/webview-helpers.test.ts` per R1-1.

A plan that budgets for one test block and meets fifteen is a plan that will be
abandoned mid-implementation.

**What would resolve it:** enumerate the affected files and the dominant repair
pattern in `plan.md`, and give the test work its own task with its own verify
command rather than tucking it inside the source tasks.

### `[MAJOR]` R1-4 — `[R] degrades to plain discovery when the suite is absent` will keep passing while testing the opposite of its name

**Evidence:** `test/capabilities.dom.test.ts:108`–`113` sends the non-suite
`GROUPS` and asserts `headings(panel)` does not contain `"Grokbit workflow"` and
`panel.hidden === false`. After the change `headings(panel)` is `[]`, so
`.not.toContain` is trivially true, and the panel is still un-hidden because it
renders the empty-state line. The test goes green while the behaviour it was
written to protect — "the menu is exactly what it was before this feature
existed" — no longer exists at all.

A regression test that passes for the wrong reason is worse than one that fails:
it is an active false assurance, and it carries an `[R]` marker telling the next
reader it guards a decision.

**What would resolve it:** rewrite it to assert the new contract — suite absent
means the panel shows the workflows-empty line and no group headings — and
update its comment to say which decision it now guards.

### `[MAJOR]` R1-5 — raising `CAPABILITY_ROW_DESCRIPTION_MAX` silently weakens a bound the code documents as a safety guard

**Evidence:** `media/webview-helpers.js:613`–`616` states the 140 cap is "mainly
a guard on ACP-only `command` rows (grok's own builtins), whose description
comes straight from the CLI with no server-side cap". The design raises it to
260 and discusses only tile aesthetics. The same helper also shapes `hint`,
which `:734`–`:737` calls "untrusted workspace text".

The change is defensible — display-only, still bounded, and the host's own cap
(280) is the outer limit — but it must be a stated decision with the comment
updated, not a number quietly edited under a comment that now describes a
different value and a different rationale.

**What would resolve it:** keep the raise, update the comment to state the new
value and that the bound is now sized for a tile rather than a single line, and
note that `command`-kind rows are not currently rendered at all, so the ACP path
the guard was written for is dormant.

### `[MINOR]` R1-6 — `display: -webkit-box` on a flex item

`.capability-row-desc` is a flex item of the `.capability-row` column. Blockified
display values interact fine in Chromium, but this is untested here. Moot if
R1-2 is resolved by dropping the clamp.

### `[MINOR]` R1-7 — the webview's `CAPABILITY_KIND_LABELS` copy is not dispositioned

`media/webview-helpers.js:606` carries all four kind labels; three become
dormant. Same `LEAVE` reasoning as `CAPABILITY_FEATURED`, but the design does
not say so, and the survey listed the constant. State it explicitly.

### `[MINOR]` R1-8 — no verification named for the "more than one column on a wide tab" done-criterion

happy-dom does not lay out (`02-survey.md` § Absences), so criterion 5 cannot be
asserted. The design's § Known limits 3 admits this for "enough room" generally
but never maps it to a specific criterion or a specific manual step.

---

## Round 2 — architect revision, then re-review

### Architect response

- **R1-1 — accepted, design revised.** Decision 1 becomes **Option A′**: a new
  exported pure `visibleCapabilityGroups(groups)` in
  `media/webview-helpers.js`, driven by `CAPABILITY_VISIBLE_KINDS = ["grokbit"]`,
  applied at `media/chat.js:972` and `:1023` immediately before each
  `capabilityGroupsView` call. `capabilityGroupsView` and its doc comment are
  left untouched, which also withdraws the `REPLACE` disposition on that comment
  (it becomes `LEAVE` — it is still true).
- **R1-2 — accepted.** The line clamp is dropped. `.capability-row-desc` gets
  `white-space: normal` + `line-height: 1.45` and nothing else bounding it.
- **R1-3 — accepted.** The test work becomes its own task (T4) with the affected
  files and the repair pattern enumerated.
- **R1-4 — accepted.** Folded into T4 as a named, individually-verified item
  rather than one of a list, because it is the one test that fails silently.
- **R1-5 — accepted.** The raise stands; the comment is rewritten in the same
  edit, and the task's `files:` names the comment explicitly so a reviewer sees
  it was not skipped.
- **R1-6 — withdrawn as moot** by the R1-2 resolution.
- **R1-7 — accepted.** `CAPABILITY_KIND_LABELS` (webview copy) added to the
  disposition table as `LEAVE`, same reason as `CAPABILITY_FEATURED`'s dormant
  entries.
- **R1-8 — accepted.** Done-criterion 5 is mapped to an explicit manual check in
  the verification matrix and labelled as manual, not automated.

### Re-review

Re-read the revised Decision 1 and Decision 3 against the same checks.

- Grounding: `visibleCapabilityGroups` is a new symbol, so no citation to
  verify; the two call sites `media/chat.js:972` and `:1023` were re-opened and
  are the only `capabilityGroupsView` callers in the repo.
- Both mounts covered: yes, and a missed call site now fails
  `test/capabilities.dom.test.ts`'s existing panel/popover parity coverage
  rather than passing.
- Session controls: structurally unreachable by the filter, unchanged.
- Empty state: both mounts still compute it from `viewGroups.length` after the
  filter, so "everything filtered out" renders the honest line, not a heading
  with no rows.
- Unhappy paths re-checked: `cap.error` path untouched (`media/chat.js:964`,
  `:1016`); `cap == null` "Scanning…" path untouched (`:1009`); priming lock
  untouched; the four lifecycle anchors untouched; `resetForNewSession` clearing
  `capabilitiesExpanded` untouched.
- Reinvention: none — the filter reuses no existing helper because none exists
  (`02-survey.md` confirms no kind-visibility policy anywhere), and the tile CSS
  reuses `.session-setup-card`'s existing recipe rather than inventing one.
- Decommission completeness: the three `REPLACE` string items each have exactly
  1 caller, all named. No caller is left pointing at an old implementation.
- Every survey supersession item now carries a disposition.

**Outstanding: zero BLOCKER, zero MAJOR.** Loop 3 exits at round 2.

---

## Loop 4 — plan-level pass over `plan.md`

Checks the translation into tasks, not the design decision again.

- **Does every `verify:` prove its `intent`?** T1's verify asserts the filter's
  behaviour through the pure function *and* through both rendered mounts, not
  just that the file parses. T2's verify asserts the trimmed output is the
  expected complete sentence for a real bundled description, not merely that the
  constant changed. T3 is CSS-only and its verify is a source check plus a named
  manual look — honest about what it can and cannot prove, which is the correct
  shape here rather than a `npm run build` stand-in. T5's verify proves an
  absence (no stale wording remains). Accepted.
- **One gap found and fixed before exit:** T2 originally verified only the
  webview cap. Because `CAPABILITY_DESCRIPTION_MAX_CHARS` (`src/capabilities.ts:169`)
  clips first, a green T2 with the host cap unchanged would have proven nothing
  about what a tile actually shows. T2's verify now covers both caps in one
  command, and `depends:` ordering makes T3's manual look happen after it.
- **Verification matrix:** every done-criterion in `01-intent.md` maps to at
  least one task. Criterion 5 (multi-column at width, single column when narrow)
  is mapped to a manual check and labelled `manual` rather than being given a
  fake automated proof.
- **Disposition summary matches `03-design.md`:** 6 `REPLACE`, 6 `LEAVE`
  (including the two added in Round 2), 0 `DEPRECATE`, 0 `COEXIST`. None
  dropped.
- **Net-additive check:** the plan is not net-additive — three strings, two
  constants, one CSS rule and one comment are rewritten in place, and the
  `LEAVE`s are each justified rather than defaulted.

**No `BLOCKER`.** Loop 4 exits.
