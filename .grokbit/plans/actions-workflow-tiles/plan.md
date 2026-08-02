# Plan — Grokbit Actions: workflows only, as readable tiles

Slug: `actions-workflow-tiles` · Approach: a pure `visibleCapabilityGroups` allowlist applied at both existing mounts, plus a sentence-aware description trim and a tile CSS pass · Blast radius: 9 files (4 source, 2 test, 1 CSS, 2 docs), 0 new dependencies, no schema change

Single-package repo — `cwd:` is `none` throughout. Verify commands are written
for **PowerShell on Windows**, the user's actual shell; each is a single
invocation with no `&&` chaining (unavailable in Windows PowerShell 5.1).

## Tasks

### T1 — Add the pure `visibleCapabilityGroups` filter (not yet wired)

- **intent:** introduce the data-driven visible-kinds allowlist as a standalone
  pure function with its own tests, changing no rendered behaviour yet
- **files:** `media/webview-helpers.js` (new `CAPABILITY_VISIBLE_KINDS` +
  `visibleCapabilityGroups`, added to the export block at `:1183`),
  `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/webview-helpers.test.ts`
- **removes:** none
- **baseline:** none — purely additive, nothing calls it yet
- **rollback:** `git checkout -- media/webview-helpers.js test/webview-helpers.test.ts`
- **state-after:** working
- **notes:** Place it beside `CAPABILITY_FEATURED` (`media/webview-helpers.js:658`)
  and follow that constant's "data, not logic" comment style — it is the
  one-entry revert path for gate question 2 and the comment must say so.
  Do **not** touch `capabilityGroupsView` (`:753`) or its doc comment: keeping
  the builder generic is exactly what stops the ~20 unit tests at
  `test/webview-helpers.test.ts:895`–`1210` from breaking (`04-review.md` R1-1).
  New tests must cover: a `grokbit` group survives; `skill`/`agent`/`command`
  groups are dropped; a group with an unknown kind is dropped; `undefined`/`{}`
  input returns `[]`; the returned array is fresh, not the caller's.

### T2 — Wire the filter into both mounts and repair the DOM tests

- **intent:** make Grokbit Actions render only the Grokbit workflow group, in
  both the welcome-canvas panel and the top-bar popover
- **files:** `media/chat.js` (apply at the two `capabilityGroupsView` call sites,
  `:972` and `:1023`), `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/capabilities.dom.test.ts`
- **removes:** none
- **baseline:** Grokbit Actions currently renders four groups (Grokbit workflow,
  Skills, Agents, Commands) in the welcome panel and those four plus Session
  controls in the popover; clicking a row seeds the composer and sends nothing;
  the Auto-accept switch sits first in the popover
- **rollback:** `git checkout -- media/chat.js test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:** These are the only two `capabilityGroupsView` callers in the repo
  (confirmed by grep). Apply the filter *before* the builder so each mount's
  existing `viewGroups.length` empty-state check (`media/chat.js:973`, `:1024`)
  still sees the post-filter count — filtering after it renders a heading with no
  rows. `sessionToggleGroup` is appended directly at `:1007` and must not be
  routed through the filter.
  **Test repair — the blast radius is ~15 cases, not one block**
  (`04-review.md` R1-3). Affected in `test/capabilities.dom.test.ts`: `:117`
  (asserts `["Agents","Commands","Skills"]`), `:129`, `:138`, `:147`, `:167`,
  `:188`, `:206`, `:223`, `:238`, `:262`, `:276`, `:394`, `:571` (asserts
  `titles` contains `"Skills"`), `:675`–`:683` (asserts exactly 3 rows), and the
  featured/expand block `:790`–`:860`. Dominant repair: swap the `GROUPS`
  fixture for a `grokbit`-kind fixture; the featured/expand block needs an
  oversized `grokbit` fixture (>4 items) so the generic expand/`+N more`
  machinery stays covered rather than silently untested — that machinery is
  `LEAVE`, not `REPLACE`.
  **One case must be rewritten, not repaired:** `:108` `[R] degrades to plain
  discovery when the suite is absent` will keep **passing while asserting the
  opposite of its name** (`headings` becomes `[]`, so `.not.toContain` is
  trivially true, and the panel is un-hidden because it now shows an empty
  state). Rewrite it to assert the new contract and update its comment
  (`04-review.md` R1-4).

### T3 — Raise both description caps and make the trim sentence-aware

- **intent:** give a tile enough characters to hold a complete sentence, and cut
  on a sentence boundary instead of mid-word
- **files:** `src/capabilities.ts` (`CAPABILITY_DESCRIPTION_MAX_CHARS` at `:169`,
  160 → 280), `media/webview-helpers.js`
  (`CAPABILITY_ROW_DESCRIPTION_MAX` at `:617`, 140 → 260, **and its comment at
  `:613`–`:616`**), `test/webview-helpers.test.ts`, `test/capabilities.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/webview-helpers.test.ts test/capabilities.test.ts`
- **removes:** the 140 and 160 cap values and the hard mid-word clip behaviour of
  `truncateCapabilityDescription` (`media/webview-helpers.js:618`–`622`); no
  files or exports deleted
- **baseline:** the description text currently rendered for each of the four
  workflows (clipped at 160 by the host, then 140 in the view model, ending in a
  mid-word "…")
- **rollback:** `git checkout -- src/capabilities.ts media/webview-helpers.js test/webview-helpers.test.ts test/capabilities.test.ts`
- **state-after:** working
- **notes:** **Both caps are required.** `src/capabilities.ts:169` clips at
  `capabilityFromSkillFile` (`:389`) *before* the payload leaves the host, so
  raising only the webview cap changes nothing a user sees — this was the gap
  Loop 4 caught. Sentence rule: prefer the last `". "` / `"? "` / `"! "` at or
  after half the cap; otherwise fall back to today's hard clip + "…". Verified
  empirically against the real frontmatter: plan → 252 chars ending
  `"…artifacts to .grokbit/plans/."`, implement → 137, test → 170, document →
  175, all complete sentences, none ellipsised. The new test must assert one of
  those real strings, not a synthetic one — asserting only that a constant
  changed proves nothing about what a tile shows. Existing truncation tests
  (`test/webview-helpers.test.ts:924`, `:1001`; `test/capabilities.test.ts:232`)
  all use `"x".repeat(N)` with no sentence boundary, so they still hit the hard-clip
  path and stay green; confirm rather than assume. **Update the comment at
  `:613`–`:616`** — it currently documents 140 as a guard on untrusted ACP
  descriptions, and leaving it stale is finding R1-5.

### T4 — Render capability rows as tiles

- **intent:** give each workflow a bordered tile with a wrapping, multi-line
  description instead of a one-line ellipsised row
- **files:** `media/chat.css` (`.capability-group-items` at `:1979`,
  `.capability-row` at `:1984`, `.capability-row-desc` at `:2035`),
  `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T3
- **verify:** `npx vitest run test/capabilities.dom.test.ts` — the CSS source
  check must assert `.capability-row-desc` no longer contains `white-space:
  nowrap`, and that `.capability-group-items` still contains `min(100%` inside
  its `minmax(`. **Then one manual look** (see the note below); this task's
  automated verify deliberately proves the *causes*, not the appearance.
- **removes:** `white-space: nowrap`, `text-overflow: ellipsis` and
  `overflow: hidden` from `.capability-row-desc`
- **baseline:** current Actions panel rendering — borderless rows, single-line
  ellipsised descriptions, 260px grid track
- **rollback:** `git checkout -- media/chat.css test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:** Card recipe copied from `.session-setup-card`
  (`media/chat.css:1846`–`1858`), applied as
  `.capability-row:not(.capability-row-toggle)` — the bare selector is shared
  with the Auto-accept switch row (`:2006`), which is a control, not a tile.
  Grid track 260px → 300px, `gap: 2px 14px` → `gap: 8px`; **keep the
  `min(100%, …)` clamp inside `minmax()`** or a ~250px split-editor tab gains a
  horizontal scrollbar. **No `@media` query** — `media/chat.css:1821`–`1822`
  states the rule and a source check counts the literal token. **No
  `-webkit-line-clamp`** — it was in the first draft and re-truncated the copy
  in CSS at ~180 of 260 characters (`04-review.md` R1-2).
  **Manual check (unavoidable — happy-dom does not lay out):** rebuild, open a
  new session tab, confirm the four tiles show full wrapped descriptions; widen
  the tab and confirm more than one column; drag it to a narrow split and
  confirm one column with no horizontal scrollbar.

### T5 — Replace the three now-inaccurate strings

- **intent:** stop the UI naming skills, agents and commands in surfaces that can
  no longer show them
- **files:** `media/chat.js` (`:980`, `:1027`), `src/sidebar.ts` (`:4652`
  `title` attribute), `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npx vitest run test/capabilities.dom.test.ts` — assertions must
  cover both new strings, and a source check must prove the absence of the old
  wording ("No skills installed yet", "No skills, commands, or agents found")
  anywhere in `media/chat.js`
- **removes:** the welcome-canvas string "No skills installed yet — just describe
  what you want in the message box.", the popover string "No skills, commands, or
  agents found.", and the `title` text "Grokbit workflow, skills, commands &
  agents"
- **baseline:** current empty-state copy in both mounts and the current button
  tooltip
- **rollback:** `git checkout -- media/chat.js src/sidebar.ts test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:** Each of the three has exactly 1 caller (survey § Supersession), so
  this is a complete decommission with no caller left behind. The empty state is
  genuinely reachable — `grok.skills.provision: "off"`, or a failed copy, means
  no `grokbit` group is ever sent. The button's visible **label** stays "Grokbit
  Actions"; only its `title` changes. `CAPABILITIES_EXPLAINER`
  (`media/chat.js:711`) stays as-is — it describes click behaviour, which is
  unchanged.

### T6 — Update the docs and run the full gate

- **intent:** keep the project map honest about what Grokbit Actions now renders,
  and prove the whole suite and the type check are green
- **files:** `CLAUDE.md` (§ Chat surfaces → capability browser bullet, and the
  § Known limits list), `CHANGELOG.md`
- **cwd:** none
- **depends:** T1, T2, T3, T4, T5
- **verify:** `npm test` (1336-test floor, all green), then
  `npx tsc -p . --noEmit` (clean)
- **removes:** none
- **baseline:** none — documentation only
- **rollback:** `git checkout -- CLAUDE.md CHANGELOG.md`
- **state-after:** working
- **notes:** CLAUDE.md's capability-browser bullet currently describes four
  groups, the featured/expand behaviour, and the workspace-source badge as live
  rendering behaviour; all three are now conditional on a kind that no longer
  renders. Add the two accepted limits from `03-design.md` § Known limits to
  § Known limits: the user's own skills/agents/commands are no longer browsable
  from any Grokbit surface, and a workspace fork of a suite skill becomes
  invisible (it stays `kind: "skill"` by design, `src/skill-suite.ts:122`–`134`).
  Per repo convention: **do not commit or push** — leave the tree uncommitted and
  rebuild locally for testing.

## Verification matrix

Every done-criterion in `01-intent.md` maps to at least one task.

| Done criterion | Proven by |
|---|---|
| New tab shows exactly one group — the four workflows in pipeline order | T2 verify (DOM test on the panel mount) |
| Top-bar button shows the same four, no Skills/Agents/Commands group | T2 verify (DOM test on the popover mount) |
| Each entry is a bordered tile with a wrapping multi-line description | T4 verify (CSS source check) + T4 manual look |
| Each description reads as complete sentences, never mid-word | T3 verify (real-description assertion) |
| Multi-column when wide, single column when narrow, no h-scroll | **manual** — T4's named manual check. happy-dom does not lay out (`02-survey.md` § Absences); T4's source check proves the `auto-fit` + `min(100%, …)` cause, not the rendered effect |
| Clicking a tile seeds `/grokbit-plan ` and sends nothing | T2 verify (existing case at `test/capabilities.dom.test.ts:96` survives) |
| Auto-accept switch still first in the popover | T2 verify (existing session-toggle block) |
| No workflows provisioned ⇒ one honest muted line | T5 verify |
| `npm test` green, no test-count reduction | T6 verify |

## Disposition summary

Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 6 | T3 (2 caps + the hard-clip behaviour), T4 (`.capability-row-desc` nowrap/ellipsis), T5 (2 strings + 1 tooltip) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 6 | documented, no task: `CAPABILITY_FEATURED` siblings, `.capability-expand` + `capabilitiesExpanded`, `.capability-more`, `.capability-row-source`, `capabilityGroupsView`'s doc comment, webview `CAPABILITY_KIND_LABELS` |

Net lines: roughly +180 / −60, the bulk of it test fixtures. Not net-additive:
two constants, one CSS rule, three strings and one comment are rewritten in
place. Each `LEAVE` carries a reason; none was chosen by default, and the four
that become unreachable-for-now stay **tested** via T2's retargeted `grokbit`
fixtures rather than being left as untested dead code.

## Open assumptions

Pointer, not a copy — the full ledger is `assumptions.md`.

Gate round 1 answered questions 1 and 2, both confirming the planned defaults —
**no task changed**. Question 3 was not answered and stands on its default.

- ~~Workflow-only applies to both mounts~~ — **CONFIRMED: both**
- ~~Losing the Skills/Agents/Commands browser~~ — **CONFIRMED: disappear
  entirely.** Largely resolved from code afterwards (`assumptions.md` § From
  grounding): Commands and Agents lose nothing material, home-tier grok skills
  stay in `/` autocomplete. Residue: a workspace-tier skill may lose its only
  surface — does not block any task.
- `UNVERIFIED` "Workflows" means the existing bundled `grokbit` group
- `UNVERIFIED` The Auto-accept switch stays (structurally unaffected either way)
- `UNVERIFIED` Derived tile copy is good enough without a hand-written blurb
  (question 3, unanswered, running on default)

## Approval

- [x] Human approved — 2026-08-01
