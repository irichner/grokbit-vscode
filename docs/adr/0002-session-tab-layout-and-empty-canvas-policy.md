# 0002. Session-tab layout and empty-canvas policy

- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Israel Richner

## Context

A Grokbit session tab is a `WebviewPanel` rendering `media/chat.js`/`chat.css` full-height
inside a VS Code editor group. Two related complaints came in together: "It's also very
narrow in the center of the tab area. Create clickable or selectable experience for the
users" plus a follow-up, "also utilize the whole tab canvass." Investigating the width
complaint (docs/plans/session-tab-ux-overhaul.md § "What is actually true today") found
that `.messages`/`.composer` were already full-bleed with no `max-width` — the narrow
appearance came entirely from a handful of `max-width: 360px` leftovers on the *welcome
canvas* (`.session-setup-card`, `.capabilities-panel`) and a few bubble/onboarding caps,
all sized for when chat lived in the 250–360px activity-bar sidebar and never revisited
after sessions moved to full editor tabs.

Fixing the width alone would still leave the empty-tab first impression unchanged: a
brand-new tab shows logo + tagline + "Starting…" and nothing else for the whole
spawn+primer window (several seconds), because the session-setup card and the capability
browser (`#capabilities-panel`) were both gated on `startingPhase` and hidden outright
until priming finished. That gate is a documented, deliberately-tested lifecycle
(CLAUDE.md § Chat surfaces, capability-browser bullet) — flipping it is the highest-risk
part of this work, since a render-from-state gate whose call sites aren't *all* updated
together renders once during priming, while the gate is shut, and never again.

Three separable decisions had to be made together because they interact: how wide the
canvas should be by default, how any residual readability measure is expressed (a fixed
pixel cap re-imports a breakpoint that lies under `grok.chatFontScale`'s CSS `zoom`), and
what the canvas shows during the priming window that used to be blank.

## Options considered

### Width — Option A: ship a `grok.chatMaxWidth` setting, default it to something safe (e.g. 1100px)
- Pros: reversible per-workspace; matches the instinct that "some cap is safer than none."
- Cons: the default the setting existed to make safe is now the *wrong* default — the
  user asked for full width, not a safer cap. `.messages`/`.composer` already had no cap
  to guard, so there is no existing behavior to protect and no migration need. A settings
  contribution is forever (schema, host reader/clamp, `onDidChangeConfiguration` branch,
  `initialState` field, broadcast message, webview handler, tests, docs) — a real
  permanent tax for a knob nobody asked to use in the direction it would default to.

### Width — Option B: full canvas by default, no setting; wide space filled by *more columns of real content*
- Pros: is what was asked for, with zero new host plumbing (CSS + two markup edits +
  the harness mirror). `#welcome-grid` and `.capability-group-items` become intrinsic
  `repeat(auto-fit, minmax(min(100%, …), 1fr))` grids that degrade to today's single
  column below their min track and flow into more columns as the tab widens — the canvas
  fills with clickable rows, not two cards stretched into a lake of background.
- Cons: a wide canvas of raw prose is genuinely harder to read than a column; addressed
  separately below rather than smuggled into the width decision.

**Decision: Option B.** No setting ships; `grok.chatMaxWidth` is dropped as YAGNI.

### Readability — Option A: a fixed-pixel, centred content column (the conventional "chat width")
- Pros: familiar pattern from most chat UIs; simple to reason about.
- Cons: this is exactly the ribbon-with-two-lakes shape the original complaint was about.
  Re-imposing it anywhere after removing the 360px caps would silently reopen the
  complaint on a wide tab.

### Readability — Option B: `@media` breakpoints switching layout at specific tab widths
- Pros: conventional responsive-design tool.
- Cons: **incorrect under this webview's zoom model.** `body` carries
  `zoom: var(--chat-zoom)` for `grok.chatFontScale`; `zoom` scales the descendant
  coordinate space, but media queries evaluate against the *unzoomed* viewport. A
  `@media (min-width: 900px)` rule would fire on a 900px-wide tab even at 150% font scale,
  where the effective content space is 600px — a breakpoint that lies at every
  non-default font scale. Rejected outright, not just avoided by convention.

### Readability — Option C: intrinsic sizing only (`auto-fit`/`minmax(min(100%, …), 1fr)`, `min()`, `ch`), plus one left-aligned prose measure
- Pros: `auto-fit`, `minmax()`, `min()`, `max()` and `ch` all resolve against the
  element's own (zoomed) box, so they stay correct at any `grok.chatFontScale`. A single
  residual rule — continuous prose inside an agent reply (`.msg.agent .body > p`, `li`,
  `blockquote`) gets `max-width: 95ch` — addresses readability without touching anything
  structural. Left-aligning it (`margin-inline: 0`, never `auto`/centred) is the detail
  that keeps this compatible with "utilize the whole canvas": a *centred* cap recreates
  the ribbon; a *left-aligned* measure just stops one paragraph from wrapping past ~95
  characters while every sibling element — cards, tool rows, code blocks, tables, the
  composer, user bubbles — still spans the full tab, so the tab visibly stays full-width.
- Cons: a genuinely wide monitor still sees agent paragraphs narrower than the canvas
  around them, which a literal read of "utilize the whole canvas" could object to.

**Decision: Option C.** If a fully edge-to-edge reading is wanted later, deleting the one
prose rule is a single CSS block — a cheap reversal, not a redesign.

### Priming-window canvas — Option A: keep hiding the setup card and capability panel until the session is ready
- Pros: zero risk to the existing, deliberately-tested lifecycle; no inversion to get
  wrong.
- Cons: leaves the single worst moment of the current first-run experience exactly as it
  is — a blank canvas (logo + tagline + "Starting…") for the whole spawn+primer window,
  which is seconds long and is precisely when a first-time, non-technical user is looking
  hardest for something to click.

### Priming-window canvas — Option B: render both mounts locked instead of hiding them
- Pros: the canvas is populated from the first frame — cards and capability rows are
  visible immediately, just non-interactive (no pointer, no hover, no click handler)
  until the session is ready. `sessionSetupModel` already had a first-class `locked` mode
  built for exactly this (`state.busy`-driven); the capability rows get an equivalent
  `.capability-row.locked`, mirroring the existing `.inert` treatment byte-for-byte.
- Cons: this is the actual risk. `initialized`/`setBusy` are two of the *four* lifecycle
  anchors documented in CLAUDE.md § Chat surfaces (capability-browser bullet); the past
  bug class this document explicitly warns about is a gate whose render-from-state isn't
  re-triggered from every call site that hides it, which renders once during priming and
  never again. Inverting two of the four anchors from "hide" to "render locked" while
  leaving the other two (`showOnboarding`'s four branches, `clearWelcome`/
  `resetForNewSession`) untouched requires get all the call sites right together, in one
  package, with the full fresh-tab sequence asserted end to end — not a partial edit.

**Decision: Option B**, scoped to its own work package (WP3) specifically because of that
risk, with `test/capabilities.dom.test.ts`'s rewritten `[R]` lifecycle case and
`test/session-setup.dom.test.ts`'s rewritten locked-during-priming case asserting the
whole `initialized → capabilities → setBusy:false` sequence: rows visible and `.locked`
(no click handler at all) through priming, then unlocked with no second
`listCapabilities` request. The three-line `#welcome-guide` strip (built by the pure
`welcomeGuide({backend, modeId})`) ships alongside this, populating the same first frame
with plain-language orientation — what you can ask, a mode- and backend-accurate line
about file/command safety, and that the composer takes plain English — wired to the exact
same four lifecycle anchors. Its Auto-accept variant deliberately states that edits apply
without asking and never claims files are protected: a false safety claim there would be
worse than the blank canvas it replaces.

## Decision

**A Grokbit session tab uses the full editor width by default, filled by more columns of
real, clickable content rather than wider cards; the only residual measure is a
left-aligned `95ch` prose cap on agent paragraphs; every remaining bound is expressed
intrinsically (`auto-fit`/`minmax(min(100%, …), 1fr)`, `min()`, `ch`) with no `@media`
queries anywhere in `chat.css`, since those lie under `grok.chatFontScale`'s zoom; and the
welcome canvas (setup card, capability panel, guide strip) renders locked, not hidden,
for the whole spawn+primer window.** The deciding factor across all three was the same:
each option that looked simpler (a pixel-width setting, an `@media` breakpoint, keep
hiding during priming) either reopened the exact problem being fixed or was measurably
wrong under an existing feature (`grok.chatFontScale`'s zoom) — while the chosen options
cost more up front (an inversion of a tested lifecycle, a new pure builder, careful
grid clamps) but are each independently reversible: delete one CSS block for the prose
cap, delete a settings entry that was never added, or revert WP3's render-locked call
sites back to hide-on-those-same-anchors.

## Consequences

- **Easier:** the width complaint is fixed with no new settings surface (no schema, no
  `onDidChangeConfiguration` branch, no broadcast message to maintain forever); a wide
  tab fills with more real, clickable rows instead of two cards stretched into empty
  space; a brand-new tab has *something* to look at and orient from within the first
  frame instead of a blank canvas for several seconds; the layout stays correct at every
  `grok.chatFontScale` value because nothing depends on the unzoomed viewport.
- **Harder / accepted trade-offs:** two of the capability panel's four documented
  lifecycle anchors now mean something different (`initialized`/`setBusy` render locked
  rather than hide) — a future reader touching this code must re-read the CLAUDE.md
  paragraph, not pattern-match off memory of the old behavior. The `95ch` prose measure
  means a very wide monitor still sees agent paragraphs narrower than the canvas around
  them; deliberate, and vetoable in one CSS deletion if that reads as contradicting "use
  the whole canvas." A locked row needs its own `.locked` CSS class and its own
  no-click-handler branch in `buildCapabilityRow`, not just a boolean flag — skipping that
  and attaching a handler that no-ops would leave a hover affordance on something that
  isn't actually clickable yet, which is worse than the blank canvas it replaces.
- **Risks & follow-ups:** the locked-during-priming inversion is the standing risk this
  ADR exists to flag — if a future change adds a fifth way to hide or show either mount
  (or the new guide strip) without routing it through the same lifecycle anchors, it will
  render once during priming and never again, exactly the failure class CLAUDE.md already
  warns about for the pre-WP3 behavior. `test/welcome-canvas.dom.test.ts`,
  `test/capabilities.dom.test.ts`'s `[R]` lifecycle case, and
  `test/session-setup.dom.test.ts`'s locked-during-priming case are the executable guards.
  `test/chat-layout.dom.test.ts` guards the `@media` count and the `min(100%, …)` clamps
  so a future "simplify this grid" doesn't reopen the narrow-split-tab overflow this
  policy was written to avoid.

## Amendment (2026-07-30) — `#welcome-grid` moves from an auto-fit grid to a wrapping flex row

The Decision above names `repeat(auto-fit, minmax(min(100%, …), 1fr))` for `#welcome-grid`
specifically. That mechanism is replaced for **this one container**; the policy it encodes
is unchanged and reaffirmed.

**Why.** `auto-fit` only collapses *empty* repetitions, so with exactly two children the
grid always produced two equal `1fr` tracks of `(W − 10)/2` — while `.session-setup-card`
is capped at its 420px form measure. The leftover width had nowhere to go, leaving dead
space of `(W − 10)/2 − 420`: zero up to `W ≈ 850px` (which is why it was never seen in a
split editor), ~185px at 1200px, ~545px at 1920px. Equal `1fr` tracks are structurally
incapable of pairing a capped-width card with a fill-the-rest panel, so no amount of
tuning the `minmax()` fixes it.

**What changed.** `.welcome-grid` is now `display: flex; flex-wrap: wrap` with
`flex: 1 1 min(100%, 300px)` on both children; the card keeps `max-width: 420px` and
freezes there, and flexbox redistributes the freed space to `.capabilities-panel`. This is
behaviour-identical below the gap threshold (same stacking point, same equal split up to
850px) and gap-closing above it, with no threshold of its own to keep in sync.
`.capability-group-items` **keeps** its `auto-fit` grid — it has a variable number of
children, which is what `auto-fit` is actually for, and a wider Actions panel now feeds it
the room to produce more columns, exactly this ADR's stated intent.

**Also decided.** `align-items: stretch` (previously `start`): the two panels share a
height so the pair reads as one flush rectangle. The extra height lands inside whichever
card is shorter — normally the setup card — and its content must stay top-pinned, which
the flex column's default `justify-content: flex-start` already does. Do not add a
`justify-content` or a growing spacer to fill it. `align-items` applies per flex *line*,
so the wrapped/stacked path is unaffected.

**Unchanged:** no `@media` queries in `chat.css`, ever; the `min(100%, …)` clamp is still
mandatory (now in the flex-basis rather than inside `minmax()`) for the ~250px
split-editor tab; the left-aligned `95ch` prose measure; locked-not-hidden during priming.
`test/chat-layout.dom.test.ts` guards each of these in its new form.
