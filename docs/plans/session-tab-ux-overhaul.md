# Session-tab UX overhaul — discoverability, full-canvas width, clickability

Status: **approved for implementation**. Owner: implementation agents, **one per work
package**. Run WP1 → WP2 → WP3 sequentially.

**All open questions are resolved** (Israel, 2026-07-29) — see § Open questions for each.
In short: the session tab uses the whole editor canvas (b); agent prose keeps a
*left-aligned* `95ch` measure (f); the welcome canvas renders **locked** during priming
rather than hidden (d); WP3's three-line guide strip **is included** (a); no new settings
ship (c). Only (e) — the "Skills" → "Actions" button copy — is left to the implementer's
judgement as trivially reversible.

## The complaint, decomposed

> "The UI in the tabs is terrible. Non technical users don't understand slash commands.
> It's also very narrow in the center of the tab area. Create clickable or selectable
> experience for the users."
>
> — follow-up: "also utilize the whole tab canvass."

Three threads, addressed separately below:

1. **Discoverability** — slash commands are invisible unless you already know to type `/`.
2. **Width** — the tab's content is a thin ribbon in the middle of a wide editor tab, and
   the tab must instead **use the whole canvas**.
3. **Clickability** — the overall shape of the tab for someone who won't type a command.

---

## What is actually true today (measured, not assumed)

### Thread 2 — where the "narrow centre" really comes from

**It is not the transcript.** `.messages` (`media/chat.css:160-167`) is
`flex: 1; padding: var(--pad)` with **no `max-width` at all**; `.composer`
(`media/chat.css:1289-1296`) is the same. Those two are already full-bleed and this plan
leaves their padding exactly as it is.

**It is everything on the welcome canvas, plus a handful of bubble/row caps.** Full survey
of every centring or bounding width in the chat webview, with the disposition this plan
gives each — this table is the coverage claim for "utilize the whole canvas":

| element | today | line | disposition |
|---|---|---|---|
| `.session-setup-card` | `max-width: 360px` | `:1767` | **Removed.** Becomes an intrinsic grid item; keeps a form measure (`max-width: 420px`) because a settings form with `space-between` rows turns into a lake when stretched. |
| `.capabilities-panel` | `max-width: 360px` | `:1808` | **Removed outright.** Full canvas width; its rows do the filling (below). |
| `.capability-group-items` | `flex` column | `:1836` | **Becomes an intrinsic grid** over its *rows* — this is the change that actually populates a wide canvas with real content instead of one tall column. |
| `.welcome-tagline` | `max-width: 320px` | `:197` | `min(100%, 60ch)` — a headline measure, still centred (it is a tagline, not content). |
| `.msg.user` | `min-width: 40%` / `max-width: 80%` | `:528-529` | **Fixed.** At 3000 px a one-word message renders a 1200 px slab. → `min-width: min(40%, 32ch)`, `max-width: min(80%, 95ch)`. |
| `.msg.agent .body` prose | *(no cap)* | — | **The one deliberate, vetoable addition** — see § Approach A3. |
| `.onb` (onboarding cards) | `max-width: 320px` | `:432` | Raised to `min(100%, 560px)`. Kept bounded on purpose: it is a transient install/sign-in **form** containing shell commands, and stretching a `<code>` line across a 4K tab is worse, not better. |
| `.media` (generated image/video) | `width: min(100%, 320px)` | `:727` | **Unchanged.** Deliberate thumbnail with open-in-editor actions; not canvas chrome. |
| `.tool-detail` | `max-width: 220px` | `:1131` | **Unchanged.** A truncated single-line detail string. |
| `.toolbar-popover` / `.studio-popover` / `.history-popover` / `.gear-popover` / `.session-settings-popover` | `min/max-width` 160–360 px | `:100`, `:224-225`, `:1607`, `:1887`, `:2518-2519` | **Unchanged.** Popovers are deliberately bounded and `positionDropdownPopover` already caps them to the panel (`media/chat.js:1553-1572`). Not the canvas. |
| `.launcher-*` | various | `:2773-2990` | **Out of scope** — different webview, see § Launcher safety. |

The 360 px numbers are leftovers from when chat lived in the activity bar; they were never
revisited when sessions moved to editor tabs.

**Launcher safety.** `media/launcher.js` reuses chat.css, but only the *row* family
(`.history-list`, `.history-row-*`, `.onb-action`, `.toolbar-popover`) plus its own
`.launcher-*` rules. It never renders `.messages`, `.composer`, `.welcome`,
`.session-setup-card`, `.capabilities-panel` or `.capability-*` (see `getLauncherHtml`,
`src/sidebar.ts:4745-4785`). **Every selector this plan touches is chat-only.** WP1 ships
a guard test for that, because it is the kind of thing a later change quietly breaks.

### Thread 1 — the capability browser already exists; its *presentation* is the problem

`grok.showCapabilities` (default `true`) already discovers and renders real skills,
agents and slash commands into two mounts from one pure builder
(`capabilityGroupsView`, `media/webview-helpers.js:599-634`; renderer
`media/chat.js:657-759`). The **data layer is right and must not be rebuilt.** What is
wrong is everything a non-technical user actually perceives:

| # | Defect | Evidence |
|---|---|---|
| D1 | The row's primary text **is the slash token**. `label: invoke ? invoke.trim() : name` | `media/webview-helpers.js:614` |
| D2 | Group order leads with **`Commands`** — the CLI's own plumbing (`/new`, `/compact`, `/resume`) — before the user's actual skills | `CAPABILITY_KIND_ORDER = ["command","skill","agent"]`, `src/capabilities.ts:62` |
| D3 | Nothing tells the user **what clicking does** (it seeds the composer and never sends — `media/chat.js:684`). No heading, no explainer. | `renderCapabilitiesPanel`, `media/chat.js:726-759` |
| D4 | No **argument hint**. Frontmatter `argument-hint` is parsed generically by `parseFrontmatter` but never carried onto `CapabilityItem` (`src/capabilities.ts:34-46`, `:334-375`); ACP's `SlashCommand.input.hint` (`src/acp.ts:68`) is dropped by `AcpCommandLike` (`src/capabilities.ts:633-636`). So a click seeds `/adr ` and leaves the user staring at a bare token. |
| D5 | The panel is **hidden for the whole priming window** (`startingPhase` gate, `media/chat.js:740`; `initialized` → `hideCapabilitiesPanel()`, `:4795`). A brand-new tab shows logo + tagline + "Starting" and nothing else for seconds. |
| D6 | After the first send the panel is gone forever (`clearWelcome`, `media/chat.js:2192`). The only remaining door is a top-bar button labelled **"Skills"** (`src/sidebar.ts:4655`) — jargon, and easy to miss. |

**Verdict: no new discovery surface.** The honest answer to "does the capability browser
already cover this?" is *the mechanism yes, the presentation no*. This plan re-presents
it and adds one extra door; it does not add a second discovery system.

### Thread 3 — one real defect plus an empty first impression

- **Orphaned duplicate `#model-label`.** `getHtml` emits `id="model-label"` **twice**:
  `src/sidebar.ts:4699` (`.model-label-btn`, in `.toolbar-left`, the live one) and
  `src/sidebar.ts:4704` (`.model-label`, in `.toolbar-right`). `.model-label` has **no
  CSS rule** and **no JS reference** (`media/chat.js:15` grabs the first by id). It ships
  today as an empty, hoverable, do-nothing button wedged between Mode and Send.
- **The empty first impression** is D5 above: during spawn + primer the canvas is blank.
- The rest of the "clickable" surface area already exists and works (session setup card,
  quick-settings popover, backend chip, Docs popover, changed-files strip, permission
  cards with inline diffs, plan banner). The problem is arrangement and copy, not absence.

---

## Goal

Make a Grokbit session tab **use the full editor canvas** and be legible and operable by
someone who will never type `/`:

- No centred ribbon anywhere. The canvas, its cards and its rows expand to the tab's real
  width and, when the tab is genuinely wide, **flow into more columns of real content**
  rather than stretching two cards across a lake of background.
- The empty canvas is **populated from the first frame**, not after priming.
- Every discovered capability reads as a **plain name with a description**, with the slash
  form shown *beside* it (teaching, not gating) and an argument hint when the CLI has one.
- One click puts a ready-to-edit prompt in the composer; nothing ever auto-sends.
- A permanent, plainly-labelled door back to that list after the welcome screen is gone.

## Non-goals (explicit)

- **Not** resurrecting `welcomeStarters` / `taskQuickActions` / `businessDocTypeStarters`
  / `businessTemplates` (`media/webview-helpers.js:639-895`). Commit `74e923a` removed
  their render sites as "not useful chrome for a thin coding client", and
  `test/friendly-ui.dom.test.ts:131-138` is the standing regression guard. **The line
  this plan holds is the same one `capability-surfacing-and-history-ux.md` § Non-goals
  drew: every clickable thing on the canvas is a real, discovered capability of the
  running CLI — never an invented prompt suggestion.** The one exception proposed (WP3's
  three-line guide strip) is *UI copy describing shipped behaviour*, not a prompt
  catalogue, and it is called out as open question (a).
- **Not** shipping a width setting. See § Approach A1 — the default *is* what was asked
  for, so a narrowing knob would be a speculative abstraction (repo convention: "Don't
  introduce abstractions speculatively").
- **Not** re-implementing any CLI capability in the webview. Thin client stands.
- **Not** an MCP / plugin / persona / workflow browser (unchanged non-goals from
  `capability-surfacing-and-history-ux.md`).
- **Not** changing the ACP wire, the session lifecycle, `retainContextWhenHidden`, the
  history popover, or the launcher's layout.
- **Not** touching the status-bar HUD's quiet-for-grok behaviour (`src/status-bar.ts`;
  `test/status-bar.test.ts` is the guard).
- **Not** virtualizing or restructuring the transcript renderer.
- **Not** a theming/visual-identity pass. The cyberpunk accent pair, icons and VS Code
  token discipline stay exactly as they are.
- No commits, no pushes, no release. Local rebuild only if Israel asks.

---

## Approach

### A. Width: full canvas by default, filled with real content

#### A1. No setting, no cap, no new host plumbing

Israel's instruction is "utilize the whole tab canvass", so **full width is the shipped
behaviour, not an option**. That inverts the earlier draft of this plan, and it makes the
proposed `grok.chatMaxWidth` setting **YAGNI — it is dropped.**

Why dropping it is right and not a shortcut:

- The default the setting existed to make safe (a 1100 px cap) is now the *wrong* default,
  so the only thing the setting would still buy is the ability to **narrow** the tab —
  which nobody has asked for.
- `.messages` / `.composer` are already uncapped today, so there is **no behaviour change
  to guard** and therefore no migration escape hatch to provide.
- The cost is not one line: a settings contribution is forever — `package.json`, a host
  reader + clamp, an `onDidChangeConfiguration` branch, an `initialState` field, a
  broadcast message type, a webview handler, tests and docs, all of it permanently
  maintained. That is a real tax for a knob with no requester.

Consequence: **WP1 touches no host logic and no `media/chat.js` at all.** It is
`media/chat.css` plus two markup edits in `getHtml` plus the test-harness mirror. Much
smaller, and it removes WP1's overlap with WP2/WP3 inside `chat.js`.

`.messages`, `.composer`, `.top-bar`, `#plan-banner` and `.slash-popover` are therefore
**left exactly as they are** — `padding: var(--pad)` is already full-bleed, and nothing
that measures rects (`positionPopover`, `media/chat.js:1537-1551`;
`positionDropdownPopover`, `:1553-1572`; `.scroll-bottom-btn`'s `left: 50%`) needs to
change.

#### A2. Filling a wide canvas means *more columns of real content*, not wider cards

Two intrinsic grids, no `@media`, no JS:

```css
/* Band 1 — the welcome cards. min(100%, …) inside minmax() is the standard
   guard: a bare minmax(300px, 1fr) OVERFLOWS a 250px split-editor tab. */
.welcome-grid {
  width: 100%;
  text-align: left;                       /* .welcome sets text-align:center */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 10px;
  align-items: start;
}
.welcome-grid > .session-setup-card { max-width: 420px; }  /* form measure — see survey */

/* Band 2 — the capability rows. THIS is what fills a wide canvas: a group with
   14 skills lays out as 14 rows across N columns, not one 3000px-wide column. */
.capability-group-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 2px 14px;
}
```

Degradation is exact: at any width below the min track both grids resolve to a single
column, which is byte-for-byte today's flex-column rendering. At ~1400 px the capability
groups show 4–5 row columns; at 3000 px, 10+. The canvas fills with **rows the user can
click**, which is the only honest way to fill it — stretching two cards to 1500 px each
would just move the lake inside the cards.

**Intrinsic sizing, never a media query — this is load-bearing.** `body` carries
`zoom: var(--chat-zoom)` (`media/chat.css:30-41`) for `grok.chatFontScale`. CSS `zoom`
scales the descendant coordinate space but **media queries still evaluate against the
unzoomed viewport**, so `@media (min-width: 900px)` would fire on a 900 px tab even at
150 % font scale, where the effective content space is 600 px — a breakpoint that lies at
every non-default font scale. `repeat(auto-fit, minmax(min(100%, …), 1fr))`, `min()`,
`max()` and `ch` all resolve against the element's own (zoomed) box and are therefore
correct at any scale. If a future change genuinely needs a breakpoint it must be a
**container query** (`container-type: inline-size` inside the zoomed subtree), never
`@media`.

*Alternative considered — a JS `ResizeObserver` writing breakpoint classes onto `body`,
with a pure `layoutBreakpoint(width)` helper for testability.* Rejected: it adds a
webview-side layout system, an observer lifecycle across the teardown/replay cycle, and a
whole class of "class is stale after reveal" bugs, to buy behaviour `auto-fit` gives for
free. Layout stays in CSS.

#### A3. Reconciling "whole canvas" with readable prose — stated, not smuggled

Full-bleed body text at 3000 px is genuinely hard to read, and the instruction was almost
certainly written with a normal monitor in mind. Rather than quietly re-imposing a cap,
here is the split, in full:

**Uncapped, edge to edge, unconditionally** — the welcome canvas and both its grids, the
setup card row, capability rows, tool rows, the activity carousel, code blocks, inline
diffs, tables, the changed-files strip, document cards, the transcript container and the
composer. Everything structural. This is the overwhelming majority of what is on screen.

**The single residual measure**, offered as a deliberate call Israel can veto:
continuous prose inside an agent message body (`.msg.agent .body > p`, `li`,
`blockquote`) gets `max-width: 95ch` — **left-aligned, `margin-inline: 0`, never
centred.** The distinction matters and is the whole reason this is compatible with
"utilize the whole canvas": a *centred* cap is the ribbon-with-two-lakes the complaint
was about; a *left-aligned* measure just stops a paragraph wrapping past ~95 characters
while every sibling element still spans the tab, so the tab visibly remains full-width.
`ch` resolves in the zoomed coordinate space, so it tracks `grok.chatFontScale` for free.

Plus the user-bubble sanity fix from the survey (`min-width: 40%` at 3000 px is a 1200 px
slab for a one-word message): `min-width: min(40%, 32ch)`, `max-width: min(80%, 95ch)`.

If Israel wants literally everything edge to edge, deleting the prose rule is one CSS
block — recorded as open question (f).

### B. Discoverability: re-present, don't rebuild

Five changes, all inside the existing pure-builder → two-mounts structure:

1. **Reorder the groups.** `CAPABILITY_KIND_ORDER` → `["skill", "agent", "command"]`
   (`src/capabilities.ts:62`). The user's own skills lead; the CLI's `/new` / `/compact`
   plumbing goes last. One producer-side assertion changes
   (`test/capabilities.test.ts:667-670`); the renderer already iterates the supplied array
   with no kind-branching, and `test/capabilities.dom.test.ts:57-58` proves it by feeding
   a deliberately scrambled order.
2. **Invert the row.** `capabilityGroupsView` returns `label = name` (the plain name) plus
   a new `invokeLabel = invoke.trim()`; the renderer draws the name as primary text and
   the slash form as a small monospace `.capability-row-cmd` chip beside it. Users read
   "adr — Record an architecture decision" and *learn* `/adr` by seeing it, instead of
   needing to know it first.
3. **Carry the argument hint.** Add `hint?: string` to `CapabilityItem`
   (`src/capabilities.ts:34-46`), populated from frontmatter `argument-hint` in
   `capabilityFromSkillFile` (`:334-375`); extend `AcpCommandLike` with
   `input?: { hint?: string }` (`:633-636`) and fill `hint` in `mergeAcpCommands`
   (`:649-677`) **under the same disk-wins-when-non-empty rule as `description`**, so a
   row's text never rewrites itself ~1 ms after `commandsUpdate` lands. Rendered as a
   dimmed `.capability-row-hint`. Hint text is untrusted workspace content: truncate it in
   the pure view-model exactly like the description
   (`truncateCapabilityDescription`, `media/webview-helpers.js:567`).
4. **Say what a click does.** The panel gains a heading and one explainer line —
   *"Click anything to drop it into the message box. Nothing is sent until you press
   Send."* This is the single highest-value sentence for the stated user; today that
   contract is invisible.
5. **A second, plainly-labelled door.** The top-bar button's label moves from **"Skills"**
   to **"Actions"** (`src/sidebar.ts:4655`), and `#add-btn`'s popover — which today holds
   exactly one item (`openAddPopover`, `media/chat.js:1911-1926`) — gains
   *"Browse skills, commands & agents…"* wired straight to `openCapabilitiesPopover()`.
   That puts a door next to the composer, where a user who has already started chatting is
   actually looking. No new host message, no new state.

Plus one small correctness fix in the same region: `updateComposerPlaceholder`
(`media/chat.js:833-838`) hardcodes "Ask Grok anything…" on a Claude tab. Make it read
`state.backend`.

*Alternative considered — a curated "Start here" shortlist ranked by a hand-written list
of well-known skill names.* Rejected: it re-imports exactly the invented-catalogue problem
`74e923a` removed, and it silently demotes a user's own workspace skills below a list we
made up.

### C. Clickability: populate the canvas from the first frame

- **Delete the orphaned `<button id="model-label" class="toolbar-btn model-label">** at
  `src/sidebar.ts:4704`.
- **Render locked instead of hiding during priming.** Today `startingPhase` hides both the
  setup card (`media/chat.js:607`) and the capability panel (`:740`), and `initialized`
  hides them outright (`:4794-4795`). Change both to **render in a locked state**: the
  setup card already has a first-class `locked` flag in `sessionSetupModel` used for
  exactly this (`state.busy` path), and the capability rows get `.capability-row.locked`
  (no click handler, same treatment as `.inert`). `setBusy:false` then simply *unlocks*
  rather than *reveals*.
  **The other three lifecycle anchors are unchanged and must stay unchanged:**
  `showOnboarding`'s four branches hide (`media/chat.js:2262-2311`), and
  `clearWelcome`/`resetForNewSession` hide (`:2192`, `:2220`). Hiding still clears the DOM
  only, never `state.capabilities`. This is the riskiest edit in the plan — it inverts a
  behaviour the existing `[R]` lifecycle test asserts — so it owns its own work package
  and its own rewritten test.
- **A three-line guide strip** (`#welcome-guide`), itself an intrinsic grid
  (`repeat(auto-fit, minmax(min(100%, 240px), 1fr))`) so on a wide canvas the three lines
  sit side by side instead of stacking into a tall left margin. Built by a new pure
  `welcomeGuide({ backend, modeId })`: what you can ask, that a plan is drafted before
  files change (or, in Auto-accept, that edits apply without asking), and that the
  composer takes plain English. Mode- and backend-accurate, so it never states something
  false. **Must not** use the `#welcome-starters` id or the `.welcome-starter` /
  `.welcome-task-chip` classes — `test/friendly-ui.dom.test.ts:134-138` asserts those are
  absent, and that assertion is the record of a deliberate removal.
- **An honest empty state.** When discovery finds nothing *and* the session is live (not
  priming), the panel renders one muted line instead of vanishing: *"No skills installed
  yet — just describe what you want in the message box."*

---

## Change surface

### New files

| File | Pure? | What |
|---|---|---|
| `test/chat-layout.dom.test.ts` | — | WP1: full-canvas source assertions, launcher-isolation guard, single `#model-label` |
| `test/welcome-canvas.dom.test.ts` | — | WP3: canvas grid mounts, guide strip, locked-during-priming lifecycle |

Everything else is a modification. No new `src/*.ts` module and **no new setting**: the two
new pure functions (`welcomeGuide`, the `capabilityGroupsView` changes) belong in
`media/webview-helpers.js`, where webview-side pure logic already lives.

### Modified

| File | Change | WP |
|---|---|---|
| `media/chat.css` | Delete `max-width: 360px` from `.session-setup-card` (`:1767`) and `.capabilities-panel` (`:1808`); new `.welcome-grid` intrinsic grid (+ `.session-setup-card` 420 px form measure as a grid item); `.capability-group-items` flex → intrinsic grid (`:1836`); `.welcome-tagline` 320px → `min(100%, 60ch)` (`:197`); `.onb` 320px → `min(100%, 560px)` (`:432`); `.msg.user` `min-width`/`max-width` sanity (`:528-529`); left-aligned `95ch` prose measure on `.msg.agent .body > p/li/blockquote` | 1 |
| `media/chat.css` | `.capability-row-cmd`, `.capability-row-hint`, `.capabilities-heading`, `.capabilities-explainer`, `.capability-row.locked` (mirroring `.inert`'s no-hover rule, `:1846-1849`) | 2, 3 |
| `media/chat.css` | `.welcome-guide` (intrinsic grid), `.welcome-guide-row` | 3 |
| `src/sidebar.ts` `getHtml` (`:4641-4741`) | Wrap `#session-setup-card` + `#capabilities-panel` in `<div id="welcome-grid">`; **delete the duplicate `#model-label` at `:4704`**; add `<div id="welcome-guide">`; top-bar button label "Skills" → "Actions" (`:4655`) | 1, 2, 3 |
| `src/capabilities.ts` | `CAPABILITY_KIND_ORDER` reorder (`:62`); `CapabilityItem.hint?` (`:34-46`); `argument-hint` in `capabilityFromSkillFile` (`:334-375`); `AcpCommandLike.input?.hint` (`:633-636`); hint merge in `mergeAcpCommands` (`:649-677`) | 2 |
| `media/webview-helpers.js` | `capabilityGroupsView`: `label = name`, new `invokeLabel`, truncated `hint` (`:599-634`); new `welcomeGuide(...)`; both exported on the `api` object (`:945`) | 2, 3 |
| `media/chat.js` | `buildCapabilityRow` name/chip/hint + `locked` (`:657-689`); panel heading/explainer/empty-state (`:726-759`); popover head copy (`:797`); `openAddPopover` extra item (`:1911-1926`); `updateComposerPlaceholder` backend-aware (`:833-838`) | 2 |
| `media/chat.js` | `renderSessionSetupCard` + `renderCapabilitiesPanel` `startingPhase` gate → locked render (`:607`, `:740`); `initialized` handler (`:4783-4797`); `setBusy` handler (`:5183-5213`); `renderWelcomeGuide` + its four lifecycle anchors | 3 |
| `test/webview-harness.ts` (`:21-65`) | mirror the new `#welcome-grid` / `#welcome-guide` markup and the removed duplicate button. **Hand-maintained mirror — chat.js's convention is `if (!el) return;`, so a missing mount fails every new DOM case silently and looks like a chat.js bug** | 1, 3 |
| `test/capabilities.test.ts` | kind-order assertion (`:667-670`); new hint cases | 2 |
| `test/capabilities.dom.test.ts` | row-text assertions (name vs slash chip); the `[R]` locked-during-priming lifecycle case (rewrite, currently asserts hidden); add-popover door | 2, 3 |
| `test/webview-helpers.test.ts` | `capabilityGroupsView` label/invokeLabel/hint cases; `welcomeGuide` cases | 2, 3 |
| `test/session-setup.dom.test.ts` | locked-during-priming (currently expects hidden) | 3 |
| `CLAUDE.md`, `README.md`, `docs/architecture.md`, `CHANGELOG.md` | per-package, see each WP | 1–3 |

### Message contract

**Unchanged.** No new host→webview or webview→host message, and no new `initialState`
field — the width work is CSS-only. `CapabilityItem` gains an optional `hint`, which is
additive on an existing payload and safely ignored by an older webview.

---

## Test strategy

Layer 1 only (`npm test`): grok-free **and** claude-free, no spawned binary, no network.
**975+ tests is the floor.** `npm run test:live` is *not* required — nothing here touches
the ACP wire — but the standing release gate is unchanged.

happy-dom has **no layout engine**, so no test may assert a computed pixel width. The
full-canvas work is verified two ways instead, both of which catch real regressions:

1. **Source-text assertions** on `media/chat.css` (the codebase already uses this
   technique — `test/capabilities.dom.test.ts:285-296` checks the `.inert` hover override,
   and the launcher suite does source parity on `LAUNCHER_PAGE_SIZE`).
2. **Structural assertions** through the real DOM: the cards are children of
   `#welcome-grid`; the harness BODY matches `getHtml`.

### WP1 — `test/chat-layout.dom.test.ts` (new) + harness

- **No ribbon left:** neither `.session-setup-card` nor `.capabilities-panel` carries
  `max-width: 360px`; `.welcome-tagline` no longer carries `320px`.
- **Grids are intrinsic and overflow-safe:** `.welcome-grid` and
  `.capability-group-items` each declare `repeat(auto-fit, minmax(min(100%,` … `), 1fr))`.
  The `min(100%, …)` inner clamp is asserted specifically — a bare `minmax(300px, 1fr)`
  overflows a 250 px split tab, and that is the one way this change could regress the
  narrow case.
- **No media queries** introduced anywhere in the file (assert the `@media` occurrence
  count in `media/chat.css` matches its pre-change value) — the `zoom` interaction in
  § Approach A2 is the reason, and it is invisible to any DOM test.
- **The prose measure is left-aligned, not centred:** the `.msg.agent .body` prose rule
  exists and does **not** contain `margin-inline: auto` / `margin: 0 auto`. This is the
  assertion that keeps the readability call from silently becoming the ribbon again.
- `.msg.user` no longer carries a bare `min-width: 40%`.
- **Launcher isolation guard:** read `src/sidebar.ts`, slice out `getLauncherHtml`'s
  template literal, assert it contains none of `messages`, `composer`, `welcome-grid`,
  `session-setup-card`, `capabilities-panel`. Cheap standing guard against a future change
  reusing a chat-canvas class in the 250 px activity bar.
- **`getHtml` contains exactly one `id="model-label"`** (source-text count) — the
  regression guard for the orphan deleted in WP1.
- `#session-setup-card` and `#capabilities-panel` are children of `#welcome-grid` in the
  real booted DOM (this also proves the harness mirror was updated).

### WP2 — capability re-presentation

`test/capabilities.test.ts`:
- `CAPABILITY_KIND_ORDER` is `["skill","agent","command"]`, and
  `buildCapabilityGroups(...).map(g => g.kind)` follows it with empty kinds omitted
  (rewrite of `:667-670`).
- **Hint from raw file text, never a hand-built frontmatter object** (the existing
  fixture-divergence discipline): text containing `argument-hint: "[short decision title]"`
  ⇒ `item.hint` set; absent ⇒ `hint` undefined.
- `mergeAcpCommands` hint precedence: a disk item with a non-empty `hint` **keeps it** when
  the ACP command supplies a different one; an empty/absent disk hint is filled from
  `cmd.input.hint`; an ACP command with no disk match carries its own hint onto the
  `kind:"command"` row. Same shape as the existing description-stability case, and for the
  same reason — the row must not rewrite itself when `commandsUpdate` lands.
- An ACP command with no `input` at all does not throw and yields no `hint`.

`test/webview-helpers.test.ts`:
- `capabilityGroupsView` returns `label === name` and `invokeLabel === "/plan"` for an
  invocable item (the **inversion** of today's behaviour — the existing assertion is the
  record of the old shape and must be rewritten, not appended to).
- A non-invocable item has no `invokeLabel`; an item with neither `invoke` nor `path` is
  still `inert`.
- A 400-character `hint` is truncated with an ellipsis (untrusted workspace text).

`test/capabilities.dom.test.ts`:
- A row renders `.capability-row-name` = the plain name **and** a `.capability-row-cmd` =
  `/name`; clicking it still seeds the composer with `"/name "` and posts **no** `send`.
- A row with a hint renders `.capability-row-hint`; one without renders none.
- The panel renders its heading + explainer line exactly once, above the first group.
- Zero groups on a live (non-priming) session ⇒ the muted empty line, **not** a hidden
  panel; zero groups while onboarding is active ⇒ still hidden (onboarding wins).
- Opening `#add-btn`'s popover shows the "Browse skills, commands & agents…" item, and
  clicking it opens `#capabilities-popover` and posts `listCapabilities` — the same two
  `stopPropagation` guards every sibling popover has must keep it open after the click
  finishes (use the harness's real bubbling `click()`).
- `updateComposerPlaceholder`: a `backendChanged` to `claude` renames the placeholder; back
  to grok restores it.
- **Regression:** `.capability-group-items` is still the intrinsic grid after WP2's row
  changes (WP2 must not revert WP1's fill-the-canvas layout).

### WP3 — canvas, guide strip, locked-during-priming

`test/welcome-canvas.dom.test.ts` (new):
- `#welcome-guide` renders three rows; the plan-mode line differs between `agent`, `plan`
  and `yolo` (assert the Auto-accept variant does **not** claim files are protected — a
  false safety claim is the failure mode that matters).
- The guide strip uses **neither** `#welcome-starters` nor `.welcome-starter` /
  `.welcome-task-chip` (the `74e923a` guard stays green — assert directly here too, so a
  future reader sees the constraint at the new code, not only in `friendly-ui`).
- `.welcome-guide` declares the same `repeat(auto-fit, minmax(min(100%,` … pattern
  (source-text) so it flows into columns on a wide canvas.
- Guide strip hides on `clearWelcome` (first `userMessage`), on each of `showOnboarding`'s
  four branches, and on `resetForNewSession`; and does not resurrect on a later
  `capabilities` message.

`test/capabilities.dom.test.ts` — **rewrite the `[R]` lifecycle case**:
- Fresh-tab sequence `initialized` → `capabilities` → `setBusy:false`: after `initialized`
  the panel is **visible and locked** (rows carry `.locked`, clicking one posts nothing and
  leaves the composer untouched); after `setBusy:false` the same rows are **unlocked** and
  clicking seeds the composer — with **no second `listCapabilities` request** (the payload
  retained in `state.capabilities` is what renders, exactly as today).
- `showOnboarding("missing-claude-adapter")` still hides the panel entirely, locked or not.
- `initialState` with `showCapabilities:false` still posts no `listCapabilities` and
  renders neither mount — the locked-render change must not leak past that gate.

`test/session-setup.dom.test.ts`:
- The setup card renders **locked** during priming (rewrite of the current expects-hidden
  case) and unlocks on `setBusy:false`; every control carries the same "Available once the
  session is ready" tooltip `renderGearMain` uses.

### Verify commands

```bash
npm test
npx tsc -p . --noEmit
```

Targeted per package:

```bash
# WP1
npx vitest run test/chat-layout.dom.test.ts test/webview-ui.dom.test.ts test/capabilities.dom.test.ts
# WP2
npx vitest run test/capabilities.test.ts test/capabilities.dom.test.ts test/webview-helpers.test.ts
# WP3
npx vitest run test/welcome-canvas.dom.test.ts test/capabilities.dom.test.ts test/session-setup.dom.test.ts test/friendly-ui.dom.test.ts
```

---

## Risks & open questions

### Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Locked-during-priming inverts a documented lifecycle** and the past bug class here is severe (a gate without matching call sites renders once, during priming, and never again — CLAUDE.md § Chat surfaces spells this out). | Isolated in WP3, with the full fresh-tab sequence asserted end to end. The other three anchors are explicitly *unchanged*. If WP3's test proves awkward, the downgrade is to keep hiding and ship only the guide strip. |
| R2 | **A bare `minmax(300px, 1fr)` overflows a narrow split tab**, turning a full-canvas change into a horizontal-scroll regression at the *other* end of the range. | The `min(100%, …)` inner clamp is mandatory and is asserted by source text in WP1. |
| R3 | **The 95ch prose measure could be read as contradicting the instruction.** | Stated explicitly (§ A3), left-aligned rather than centred so no lake appears, asserted as left-aligned in WP1's tests, and vetoable as open question (f). |
| R4 | On a very wide canvas the capability grid could render a large number of visible rows at once. | Already bounded: `CAPABILITY_GROUP_CAP = 40` per group (`src/capabilities.ts:140`) with a `+N more` tail. Nothing new to do. |
| R5 | happy-dom can't verify layout, so a width regression can pass CI. | Accepted, and bounded by the source-text + structural tests. A visual check at four widths (250 px split, ~900 px, maximised, and `chatFontScale: 150`) is part of WP1's manual step. |
| R6 | `test/webview-harness.ts`'s `BODY` is a hand-maintained mirror; drift makes new DOM tests fail with null mounts and look like chat.js bugs. | Called out in the change surface for WP1 and WP3; both packages update it in the same step as `getHtml`. |
| R7 | Renaming the top-bar button "Skills" → "Actions" churns user muscle memory and the DOM-test copy. | Cosmetic and reversible; open question (e). |

### Open questions

**(b) How aggressive is the default content width? — DECIDED by Israel: full canvas.**
The tab uses the whole editor width by default. No width setting ships
(`grok.chatMaxWidth` is dropped as YAGNI, § A1); the welcome cards' 360 px caps are
removed; wide canvases fill with additional columns of real, clickable rows rather than
stretched cards. The only residual measure is the left-aligned prose rule in § A3, itself
vetoable as (f).

**(a) Do we resurrect any removed starter/template surface? — DECIDED: no, except the
guide strip, which ships.** The removed catalogues stay removed and
`test/friendly-ui.dom.test.ts:134-138` stays green; WP3's three-line guide strip **is
included** as specified. Original analysis follows.

**Recommendation: no**, with one narrow exception. The catalogues (`welcomeStarters` /
`taskQuickActions` / `businessTemplates`) were invented prompt suggestions with no
relationship to what the CLI can do; `74e923a` was right to remove them and
`test/friendly-ui.dom.test.ts:134-138` should stay green. The exception this plan proposes
is WP3's **three-line guide strip**, which is UI copy describing shipped, mode-accurate
behaviour (plan mode, permission cards) rather than a prompt catalogue. If you consider
that too close to the removed chrome, drop it — WP3 still delivers the grid mounts and the
locked-during-priming fix.

**(c) On by default, or opt-in? — DECIDED: no new settings at all.** The guide strip ships
un-flagged, under the existing gates. Original analysis follows.

**Recommendation: no new settings at all.** With the width knob dropped, this plan adds
zero settings contributions. The capability re-presentation is a redesign of a surface
that is already on by default and already has its own switch (`grok.showCapabilities`);
the guide strip and the `#add-btn` door live under existing gates. Say no if you want the
guide strip behind its own flag; that is the only piece where opt-in is defensible.

**(d) Locked-during-priming, or keep hiding? — DECIDED: locked.** WP3 implements the
inversion, with the full fresh-tab sequence asserted end to end per R1. Original analysis
follows.

**Recommendation: locked.** A blank canvas for the whole spawn+primer window is the single
worst moment in the current first-run experience, and `sessionSetupModel` already has a
`locked` mode built for exactly this. But it inverts a documented, deliberately-tested
behaviour, so it should be a conscious call rather than a side effect of WP3.

**(e) Top-bar button copy: "Skills" → "Actions"?**
Pure copy. Recommendation: yes — "Skills" is the CLI's word, not the user's — but it is
trivially reversible either way.

**(f) Residual tension — should agent prose also go edge to edge? — DECIDED: keep the
`95ch` measure.** Agent paragraphs keep a **left-aligned** (`margin-inline: 0`, never
centred) `95ch` max-width; everything structural — cards, capability grid, tool rows,
composer, user bubbles — is uncapped. WP1's test asserting the rule contains no
`margin-inline: auto` is **mandatory**: centring it would recreate the exact ribbon this
work exists to remove.

### Worth an ADR

The durable decision is now: **"a Grokbit session tab uses the full editor width by
default."** Its main consequence — the left-aligned `95ch` prose measure, and the choice
to express every remaining bound intrinsically (`auto-fit`/`minmax(min(100%, …))`,
`min()`, `ch`) rather than with media queries that lie under `zoom` — is exactly what a
future reader would otherwise "tidy up" back into a centred column. Record it with the
**`adr` skill** together with (d)'s priming-window render policy, as one ADR
("Session-tab layout and empty-canvas policy"), and cross-reference it from CLAUDE.md
§ Chat surfaces — the same both-sides recording discipline the status-bar/history-badge
divergence already uses.

---

## Work packages

**Three packages. One implementer dispatch handles one package end to end — its code, its
tests and its doc updates.** They are **sequential, not parallel**: WP2 and WP3 both touch
`media/chat.js`'s capability region and `media/chat.css`, and WP3's canvas work sits inside
the grid WP1 introduces. Run WP1 → WP2 → WP3. Each ends green on the full suite, so a stop
after any one of them leaves a shippable tree.

### WP1 — Full canvas: de-ribbon the tab

Owns the reported width complaint end to end, plus the one hard defect found. **CSS + two
markup edits + the harness mirror — no host logic, no `media/chat.js`, no new setting.**

- [x] Delete `max-width: 360px` from `.session-setup-card` (`media/chat.css:1767`) and
      `.capabilities-panel` (`:1808`); give each `min-width: 0`.
- [x] Add `.welcome-grid`: `width:100%`, `text-align:left` (`.welcome` sets `center`),
      `display:grid`, `repeat(auto-fit, minmax(min(100%, 300px), 1fr))`, `gap:10px`,
      `align-items:start`. Give `.welcome-grid > .session-setup-card` a `max-width: 420px`
      form measure. **The `min(100%, …)` inner clamp is mandatory** (R2).
- [x] Convert `.capability-group-items` (`:1836`) from flex column to
      `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` with `gap: 2px 14px` — this is the
      change that actually fills a wide canvas with clickable rows.
- [x] `.welcome-tagline` 320px → `min(100%, 60ch)` (`:197`); `.onb` 320px →
      `min(100%, 560px)` (`:432`).
- [x] `.msg.user` (`:528-529`): `min-width: min(40%, 32ch)`, `max-width: min(80%, 95ch)`.
- [x] Add the § A3 prose measure on `.msg.agent .body > p, > li, > blockquote`:
      `max-width: 95ch; margin-inline: 0;` — **left-aligned, never centred**, with a
      comment saying why (a centred cap is the ribbon the complaint was about).
- [x] **No `@media` queries** anywhere — see § Approach A2 for why they lie under `zoom`.
- [x] `getHtml` (`src/sidebar.ts:4641-4741`): wrap `#session-setup-card` +
      `#capabilities-panel` in `<div id="welcome-grid" class="welcome-grid">`; **delete
      the duplicate `<button id="model-label" class="toolbar-btn model-label">` at `:4704`**.
- [x] Mirror the new `#welcome-grid` markup and the removed button into
      `test/webview-harness.ts` (`:21-65`).
- [x] Docs: CLAUDE.md § Chat surfaces (the full-canvas policy — intrinsic sizing only, the
      no-`@media`/`zoom` rule, and the one left-aligned prose measure with its rationale);
      README; `CHANGELOG.md` under the unreleased section.

Ships with: `test/chat-layout.dom.test.ts` (new — no 360 px caps, both grids declare the
`min(100%, …)` clamp, unchanged `@media` count, prose rule present and *not* centred,
`.msg.user` fixed, launcher-isolation guard, exactly one `#model-label`, cards parented by
`#welcome-grid`).

Verify: `npm test && npx tsc -p . --noEmit`, then eyeball four widths — a 250 px split tab
(must be byte-identical to today), ~900 px, maximised, and `grok.chatFontScale: 150` (the
case a media query would have broken).

### WP2 — Capability rows in plain language

Owns: "non-technical users don't understand slash commands."

- [x] `src/capabilities.ts`: `CAPABILITY_KIND_ORDER` → `["skill","agent","command"]`
      (`:62`); `CapabilityItem.hint?` (`:34-46`); read `argument-hint` in
      `capabilityFromSkillFile` (`:334-375`); `AcpCommandLike.input?: { hint?: string }`
      (`:633-636`); fill `hint` in `mergeAcpCommands` under the **disk-wins-when-non-empty**
      rule (`:649-677`).
- [x] `media/webview-helpers.js` `capabilityGroupsView` (`:599-634`): `label = name`, new
      `invokeLabel = invoke.trim()`, truncated `hint`. Keep iterating the supplied `groups`
      array with no kind-branching.
- [x] `media/chat.js` `buildCapabilityRow` (`:657-689`): plain name as primary text,
      `.capability-row-cmd` chip, `.capability-row-hint`. Click behaviour unchanged — seed
      the composer, never auto-send.
- [x] `media/chat.js` `renderCapabilitiesPanel` (`:726-759`): heading + explainer line;
      live-but-empty ⇒ the muted "no skills installed" line instead of hiding. Popover head
      copy (`:797`) matches.
- [x] `media/chat.js` `openAddPopover` (`:1911-1926`): add "Browse skills, commands &
      agents…" → `openCapabilitiesPopover()`.
- [x] `src/sidebar.ts:4655`: top-bar button label per open question (e). Took (e)'s
      recommendation — "Skills" → "Actions" — since it's the CLI's own word, not the
      user's; the button's `title` tooltip is unchanged ("Skills, commands & agents", now
      genuinely more descriptive than the terse label above it).
- [x] `media/chat.js` `updateComposerPlaceholder` (`:833-838`): backend-aware.
- [x] `media/chat.css`: `.capability-row-cmd`, `.capability-row-hint`,
      `.capabilities-heading`, `.capabilities-explainer` — VS Code tokens only.
      **Do not revert WP1's `.capability-group-items` grid.**
- [x] Docs: CLAUDE.md § Chat surfaces (capability-browser bullet — row shape, hint source,
      group order, the second door) and § Module map (`capabilities.ts` row); README;
      `docs/architecture.md`; `CHANGELOG.md`.

Ships with: rewritten `test/capabilities.test.ts` order + new hint/precedence cases;
rewritten `capabilityGroupsView` cases in `test/webview-helpers.test.ts`; rewritten row
assertions plus the add-popover door, placeholder, and grid-still-present cases in
`test/capabilities.dom.test.ts`.

Verify: `npm test && npx tsc -p . --noEmit`.

### WP3 — A canvas that is populated from the first frame

Owns: "create a clickable or selectable experience" — the empty-tab first impression.
**Highest-risk package (R1); do it last, on a green tree.**

- [x] `media/chat.js`: change the `startingPhase` branch of `renderSessionSetupCard`
      (`:607`) and `renderCapabilitiesPanel` (`:740`) from *hide* to *render locked*;
      `initialized` (`:4783-4797`) re-renders locked instead of hiding; `setBusy:false`
      (`:5183-5213`) unlocks. **Leave the onboarding and `clearWelcome`/
      `resetForNewSession` anchors hiding, unchanged.**
- [x] `.capability-row.locked` in CSS, mirroring `.inert`'s no-pointer/no-hover pair
      (`media/chat.css:1846-1849`); locked rows install no click handler at all.
- [x] New pure `welcomeGuide({ backend, modeId })` in `media/webview-helpers.js` (exported
      on `api`, `:945`) — three mode- and backend-accurate lines; the Auto-accept variant
      must not claim files are protected.
- [x] `#welcome-guide` mount in `getHtml` above `#welcome-grid`, styled as its own
      intrinsic grid (`repeat(auto-fit, minmax(min(100%, 240px), 1fr))`) so the three lines
      flow into columns on a wide canvas instead of stacking. `renderWelcomeGuide()` wired
      to the **same four lifecycle anchors** the capability panel uses, and re-rendered on
      `modeChanged` / `backendChanged` so its copy never goes stale. **Must not** use
      `#welcome-starters` / `.welcome-starter` / `.welcome-task-chip`.
- [x] Mirror the new markup into `test/webview-harness.ts`.
- [x] Docs: CLAUDE.md § Chat surfaces — rewrite the capability-browser bullet's lifecycle
      paragraph (the `initialized` anchor is no longer "hide") and add the welcome-canvas
      description, **recording why locked beats hidden** so a future reader does not revert
      it; `CHANGELOG.md`; ADR per § Worth an ADR.

Ships with: `test/welcome-canvas.dom.test.ts` (new — grid parentage, guide-strip content
per mode, intrinsic-grid source assertion, removed-chrome class guard, all four hide
anchors); the rewritten `[R]` locked-during-priming case in `test/capabilities.dom.test.ts`;
the rewritten locked-vs-hidden case in `test/session-setup.dom.test.ts`;
`test/friendly-ui.dom.test.ts` must stay green **unmodified**.

Verify: `npm test && npx tsc -p . --noEmit`, then manually open a fresh tab and watch the
whole spawn → primer → ready sequence: the cards must be visible and inert throughout,
then become live, with no flicker and no double request.
