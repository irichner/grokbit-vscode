# Design — Grokbit Actions: workflows only, as readable tiles

Two decisions are needed: **where the group filter lives**, and **how a tile
gets readable copy**. They are independent, so each is decided separately below.

---

## Decision 1 — where the group filter lives

### Option A — a data-driven visible-kinds allowlist inside `capabilityGroupsView`

Add a module-level constant beside `CAPABILITY_FEATURED`:

```js
const CAPABILITY_VISIBLE_KINDS = ["grokbit"];
```

and drop non-member groups at the top of `capabilityGroupsView`'s loop
(`media/webview-helpers.js:757`).

- **Trade-off, stated against the constraints:** both mounts are covered with
  zero renderer change, because both already funnel through this one builder
  (`media/chat.js:972` panel, `:1023` popover) — verified in the survey. The
  Session-controls toggle group is structurally unaffected: `sessionToggleGroup`
  never passes through `capabilityGroupsView` (`media/chat.js:1007` appends it
  directly), so "keep Auto-accept" costs nothing and cannot regress. It honours
  the standing "renderer must not branch on kind strings" rule — this is
  set-membership against a declared allowlist in the pure view model, the same
  shape as `CAPABILITY_KIND_ORDER` (`src/capabilities.ts:82`), not an `if` in
  `buildCapabilityRow`. Restoring a kind is one array entry.
- **Cost:** the host keeps scanning and sending groups the UI throws away.
  `CAPABILITY_SCAN_FILE_CAP = 300` (`src/capabilities.ts:158`) bounds that work,
  it is request-driven, and it cannot be avoided anyway — the suite lives in the
  *same* home-tier `skills` roots the ordinary `skill` roots scan
  (`src/skill-suite.ts:81`–`86`, `src/capabilities.ts:126`), so the scan that
  finds the workflows is the scan that finds everything else.
- **Also costs:** `capabilityGroupsView`'s doc comment currently promises "no
  fixed keys, no three-kind branching" (`media/webview-helpers.js:713`–`718`).
  That comment must be amended in the same change or it becomes a lie the next
  reader trusts.

### Option B — filter at the host, in `buildCapabilityGroups` / `listCapabilities`

Stop emitting non-`grokbit` groups at `src/capabilities.ts:746` or filter the
array before posting at `src/sidebar.ts:3152`.

- **Trade-off:** the payload shrinks and nothing unused crosses the boundary.
  But `buildCapabilityGroups` is a pure module whose documented contract is "one
  group per kind, ordered by `CAPABILITY_KIND_ORDER`, empty groups dropped"
  (`src/capabilities.ts:729`–`749`), tested directly in `test/capabilities.test.ts`;
  a visibility policy there conflates *what exists* with *what is shown*. It also
  puts a UI decision behind a host round-trip: any future "show everything else"
  affordance (gate question 2) becomes a protocol change instead of a render
  change. And it saves nothing measurable, because the scan still has to run for
  the suite.
- **Better at:** payload size, and being the only place to look if the answer to
  gate question 2 is "permanently, everywhere, gone".

### Option C (rejected without a full write-up) — filter in `appendCapabilityGroups`

Rejected because `appendCapabilityGroups` (`media/chat.js:870`) also renders the
Session-controls group (`:1007`), so it would need an exclusion for it; and
because both mounts compute their empty state from `viewGroups.length`
*before* calling it (`media/chat.js:973`, `:1024`) — filtering downstream of that
check produces a panel with a heading, an explainer, and no rows, which is the
one state the honest-empty-state rule exists to prevent.

### Chosen: **Option A′** (Option A, revised after review round 1)

Option A's placement — *inside* `capabilityGroupsView` — was rejected in review
(`04-review.md` R1-1): every one of the ~20 unit tests in that builder's describe
block (`test/webview-helpers.test.ts:895`–`1210`) constructs
`skill`/`agent`/`command` groups, so an internal allowlist returns `[]` and each
`v[0].items[0]` throws. It also required amending the builder's own "no fixed
keys, no three-kind branching" contract, which is a signal the filter does not
belong there.

**A′:** a new exported pure function in `media/webview-helpers.js`, beside the
builder rather than inside it:

```js
const CAPABILITY_VISIBLE_KINDS = ["grokbit"];
function visibleCapabilityGroups(groups) { /* filter by kind membership */ }
```

applied by each mount immediately before its existing `capabilityGroupsView`
call — `media/chat.js:972` (panel) and `:1023` (popover), the only two callers
in the repo.

Two one-line call sites instead of one, and in exchange: zero existing unit
tests break, `capabilityGroupsView`'s generic contract stays literally true, the
filter gets its own small focused test, and a missed call site fails an existing
DOM test rather than passing silently. The Session-controls group remains
structurally unreachable by the filter — `sessionToggleGroup` is appended
directly at `media/chat.js:1007` and never passes either call site. Both mounts
still compute their empty state from `viewGroups.length` *after* the filter
(`media/chat.js:973`, `:1024`), so "everything filtered out" renders the honest
empty line rather than a heading with no rows.

Option B would have been better if the goal were to stop *discovering* the other
kinds — it is not (`01-intent.md` § Non-goals makes discovery explicitly out of
scope), and the scan cannot be skipped regardless.

---

## Decision 2 — how a tile gets readable copy

The bundled descriptions are 566–710 characters of model-routing prose
(`resources/skills/*/SKILL.md` line 3) — they open with a genuine "what it does"
sentence and then continue into "Use this skill whenever the user asks to…".
Two caps clip them before display: 160 at the host
(`src/capabilities.ts:169`, applied `:389`) and 140 in the view model
(`media/webview-helpers.js:617`), the second cutting mid-word with an ellipsis.

### Option 1 — raise both caps, and make the trim sentence-aware

Raise `CAPABILITY_DESCRIPTION_MAX_CHARS` 160 → 280 and
`CAPABILITY_ROW_DESCRIPTION_MAX` 140 → 260, and change
`truncateCapabilityDescription` to prefer the last sentence boundary (`. `,
`? `, `! `) at or after half the cap, falling back to today's hard clip.

- **Trade-off:** no new data, no new frontmatter field, no fifth thing to keep
  in step with `SUITE_SKILL_NAMES`, and it works for any item — including a
  user's own skill if gate question 2 brings other kinds back. **Measured, not
  assumed:** running this exact rule over the four real descriptions yields
  complete sentences for all four with no ellipsis —
  grokbit-plan 252 chars ("…writes durable artifacts to .grokbit/plans/."),
  grokbit-implement 137, grokbit-test 170, grokbit-document 175.
- **Cost:** the copy is whatever the skill author wrote for the *model*. It
  reads well today by inspection, but nothing guarantees the first sentences of
  a future edit will. The host cap change affects all kinds' payload size
  (≤ 100 items × 280 bytes per group — negligible).

### Option 2 — a curated `CAPABILITY_BLURBS` map in the webview

Name → hand-written one-liner, falling back to the description.

- **Trade-off:** best possible copy, fully under our control. But it is a
  **fifth** place that must stay in step with `SUITE_SKILL_NAMES`
  (`src/skill-suite.ts:40`–`46` already names four), and it silently rots — a
  renamed skill shows its raw routing prose with nothing failing. It also does
  nothing for any non-suite item.

### Option 3 — a `short-description` frontmatter key honoured by `capabilityFromSkillFile`

- **Trade-off:** no sync map, degrades gracefully, and user skills can opt in.
  But it adds a field to `CapabilityItem` (`src/capabilities.ts:40`) and changes
  a pure, heavily-tested module for what is currently a display concern, and it
  needs the cap raise from Option 1 anyway to be visible.

### Chosen: **Option 1**

It is the smallest change that provably meets the "complete sentences"
done-criterion, and the proof is empirical rather than argued. Option 3 is the
right escalation *if* the derived copy ever reads badly — it is additive on top
of Option 1, not a competing path, so choosing Option 1 now costs nothing later.
Option 2 is rejected outright: a hand-maintained name→copy map with no failure
signal is exactly the kind of silent-drift duplicate this repo's survey
conventions exist to prevent.

---

## Decision 3 — the tile itself (CSS only)

Not a multi-option decision; the constraints leave one shape.

- `.capability-group-items` (`media/chat.css:1979`): min track 260px → 300px,
  `gap: 2px 14px` → `gap: 8px`. The `min(100%, …)` clamp stays — it is what
  keeps a ~250px split-editor tab from scrolling horizontally.
- `.capability-row:not(.capability-row-toggle)` gets the existing card recipe
  copied from `.session-setup-card` (`media/chat.css:1846`–`1858`):
  `1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #444))`,
  `background: var(--vscode-editorWidget-background, var(--vscode-editor-background))`,
  `border-radius: var(--radius, 6px)`, `padding: 8px 10px`, `gap: 4px`.
  The `:not()` is deliberate: `.capability-row` is shared with the Auto-accept
  switch row (`media/chat.css:2006`), and it is a control, not a tile.
- `.capability-row-desc` (`media/chat.css:2035`): drop `white-space: nowrap`,
  `text-overflow: ellipsis` and `overflow: hidden`; add `white-space: normal`
  and `line-height: 1.45`. **No line clamp** — a `-webkit-line-clamp: 4` was in
  the first draft and was rejected in review (`04-review.md` R1-2): at the 300px
  track and 11px font, four lines holds ~180 characters against a 260-character
  trim, so the tile would have re-truncated mid-sentence in CSS, defeating
  done-criterion 4 in a layer no test can see. There are four tiles; they cannot
  become a wall of text, and the `auto-fit` grid already equalises row heights.
- No `@media` query, per `media/chat.css:1821`–`1822`.
- `.capability-row-name` keeps its ellipsis — a name is one token, and the four
  suite names are short.

---

## Disposition table

Every item in `02-survey.md` § Supersession, with a reason.

| Item | Disposition | Reason |
|---|---|---|
| Welcome-canvas empty-state string (`media/chat.js:980`) | **REPLACE** | Says "skills"; the only state it renders in is now "no workflows". 1 caller, replaced in place. |
| Popover empty-state string (`media/chat.js:1027`) | **REPLACE** | Same, 1 caller. |
| `#capabilities-btn` `title` (`src/sidebar.ts:4652`) | **REPLACE** | Tooltip names three kinds the button no longer opens. 1 caller. |
| `.capability-row-desc` `nowrap` + ellipsis (`media/chat.css:2038`–`2040`) | **REPLACE** | It *is* the single-line clip the request asks to remove. |
| `CAPABILITY_ROW_DESCRIPTION_MAX = 140` + hard clip (`media/webview-helpers.js:617`–`622`) | **REPLACE** | Raised to 260 and made sentence-aware; both callers (`description`, `hint`) keep using the same helper, so nothing forks. |
| `CAPABILITY_DESCRIPTION_MAX_CHARS = 160` (`src/capabilities.ts:169`) | **REPLACE** | Raised to 280. Not optional — it clips *before* the webview sees the text, so leaving it would make the view-model change a no-op. |
| `CAPABILITY_FEATURED.skill`/`.agent`/`.command` (`media/webview-helpers.js:660`–`671`) | **LEAVE** | Three dormant array entries. They are the revert path for gate question 2, and `partitionFeatured` itself stays live and load-bearing — `CAPABILITY_FEATURED.grokbit` (`:659`) is the *only* thing that orders the four suite tiles into pipeline order. Deleting the siblings buys nothing and would have to be rewritten to restore a kind. A comment records that they are dormant while `CAPABILITY_VISIBLE_KINDS` excludes those kinds. |
| `.capability-expand` + `state.capabilitiesExpanded` (`media/chat.js:895`–`919`, `:83`, `:2500`) | **LEAVE** | Generic renderer machinery, unreachable for the suite only because `featuredCount === items.length`. It stays **tested** — the featured/expand test block is retargeted onto an oversized `grokbit` fixture rather than deleted, so "unreachable today" never becomes "untested and quietly broken". |
| `.capability-more` "+N more" (`media/chat.js:888`–`893`) | **LEAVE** | Same machinery, same retargeted coverage (`total` > items on a `grokbit` fixture). |
| `.capability-row-source` badge + `workspaceSource` (`media/chat.js:788`–`797`, `media/webview-helpers.js:776`) | **LEAVE** | Cannot render for a suite item (`applySuiteKind` stamps `source: "Grokbit"`, `src/skill-suite.ts:160`). Kept because it is generic per-item provenance, and because a **workspace fork** of a suite skill deliberately stays `kind: "skill"` (`src/skill-suite.ts:130`–`134`) — which this change now *hides*. That consequence is recorded as a known limit, not silently accepted. Its view-model unit test (`test/webview-helpers.test.ts`) still covers it directly. |
| `capabilityGroupsView`'s "no fixed keys, no three-kind branching" doc comment (`media/webview-helpers.js:713`–`718`) | **LEAVE** | Was `REPLACE` under Option A. Under A′ the builder is untouched and the comment stays literally true; the filter is a separate, separately-documented function (`04-review.md` R1-1). |
| `CAPABILITY_KIND_LABELS`, webview copy (`media/webview-helpers.js:606`) | **LEAVE** | Three of four entries become dormant. Same reason as `CAPABILITY_FEATURED`'s siblings: fallback data for a group missing its own `title`, costs nothing, part of the one-entry revert path. Added after review round 1 (`04-review.md` R1-7). |

No `DEPRECATE` and no `COEXIST` in this change. Nothing here is being migrated
over time, and nothing gains a second implementation — the one thing that could
have (a second filter site, host *and* view) was explicitly decided against in
Decision 1.

**Totals: 6 `REPLACE`, 6 `LEAVE`, 0 `DEPRECATE`, 0 `COEXIST`.**

---

## Known limits this change knowingly accepts

Stated here so the Reviewer and the human at the gate see them as decisions, not
oversights.

1. **The user's own skills, agents, and CLI commands are no longer browsable
   from any Grokbit surface.** Confirmed at the gate ("disappear entirely"). The
   loss is smaller than it first appears, broken down by kind:
   - *Commands:* nothing lost. A `kind: "command"` row is only ever built from
     an ACP command (`src/capabilities.ts:706`), so every one of them is already
     in the `/` autocomplete list by construction.
   - *Agents:* no invocation lost — an agent is never user-invocable
     (`src/capabilities.ts:399`). Only a file-open shortcut goes away.
   - *Home-tier grok skills:* documented to remain in `/` autocomplete
     (`docs/SLASH-COMMANDS.md:5`, `:38`).
   - *Workspace-tier skills:* the genuine residue — unconfirmed whether the CLI
     registers them as slash commands, so one of these could lose its only
     surface. Tracked in `assumptions.md` § From grounding; does not block any
     task.
2. **A workspace fork of a suite skill becomes invisible.** `applySuiteKind`
   deliberately leaves a repo-authored `grokbit-plan` as `kind: "skill"` so it
   is not badged as ours (`src/skill-suite.ts:122`–`134`); it now falls outside
   `CAPABILITY_VISIBLE_KINDS` and disappears from the menu entirely.
3. **"Enough room to read" has no automated proof.** happy-dom does not lay out,
   and the repo has no visual test (`02-survey.md` § Absences). The plan verifies
   the *causes* as CSS source facts and the *copy* as a pure-function assertion,
   then requires one explicit human look. It does not claim more.
