# Actions panel — featured capabilities + per-group expand

## Problem

The Actions surfaces (welcome-canvas `#capabilities-panel` and the top-bar
`#capabilities-popover`) render **every** discovered item in each group, up to the
host's `CAPABILITY_GROUP_CAP = 100`. On a machine with a real skill/command
install that's a wall of rows — the panel stops being scannable and the items the
user actually reaches for are buried among ones they never invoke.

## Goal

Each group shows a small **featured** set by default and hides the rest behind an
**expand link centred at the bottom of the group**. Featured sets (from the
operator):

| Group | Featured |
|---|---|
| Skills | `plan`, `implement` |
| Agents | `explore` |
| Commands | `cold-review`, `init-repo`, `docx`, `pptx`, `pdf`, `create-workflow`, `workflow`, `deep-research`, `always-approve` |

## Approach

Keep the existing split: **partition in the pure view-model, render in chat.js.**
`capabilityGroupsView` already owns per-item shaping and is unit-tested without a
DOM; the renderer stays a dumb consumer that never branches on kind strings.

### Decisions

1. **Featured list is data, not logic.** A `CAPABILITY_FEATURED` map in
   `media/webview-helpers.js`, keyed by `CapabilityKind`, values lower-cased
   names. Matching is case-insensitive on `item.name` so `Plan` / `plan` /
   `Workflow` / `workflow` all land. A future kind needs one map entry, not a
   renderer change — same data-driven rule as `CAPABILITY_KIND_ORDER`.
2. **Featured items sort to the front, in the configured order**; the rest keep
   their host-given order behind them. The group carries a new
   `featuredCount` — the renderer slices, it does not re-sort.
3. **No featured match ⇒ fall back to the first `CAPABILITY_FEATURED_FALLBACK`
   (5) items.** A group whose kind has no configured list (or whose install
   contains none of the named items) still collapses, so the panel is compact for
   everyone rather than only on this machine. Never collapses to zero rows.
4. **Expansion state lives in `state.capabilitiesExpanded`** (`{[kind]: true}`),
   so a re-render — `setBusy` lock/unlock, `modeChanged` re-rendering the open
   popover, a `Refresh` — does not silently re-collapse a group the user opened.
   Cleared in `resetForNewSession` alongside the rest of the per-session UI state.
   Shared by both mounts by design: they are two views of one list.
5. **Expand works while `locked`.** Unlike `Refresh` (a host round-trip) and row
   clicks (a composer seed), expanding is pure local display — nothing about the
   priming window makes it a lie.
6. **`+N more` (host-cap overflow) survives, but only while expanded** — it is a
   dead-end label about items the host never sent, distinct from the expand link,
   and showing both collapsed would read as two competing "there's more" signals.
7. **The `sessionToggleGroup` ("Session controls") is untouched** — it never goes
   through `capabilityGroupsView`, has one item, and gets no expand link.
8. `always-approve` is spelled `alawys-approve` in the request. Both spellings go
   in the list with a comment; costs one array entry and cannot be wrong.

### Work package 1 — view-model, renderer, styles, tests, docs

*(One package: the pure builder, its single renderer, and their tests are one
change — splitting them would leave a half-wired feature at the boundary.)*

- [x] `media/webview-helpers.js` — add `CAPABILITY_FEATURED`,
      `CAPABILITY_FEATURED_FALLBACK`, and a pure `partitionFeatured(items, kind)`;
      call it from `capabilityGroupsView` so each returned group carries ordered
      `items` + `featuredCount`. Export the new constants for tests.
- [x] `media/chat.js` — `appendCapabilityGroups` renders
      `items.slice(0, expanded ? items.length : group.featuredCount)`, appends a
      centred `.capability-expand` button **after** `itemsEl` (not inside it — the
      items container is an `auto-fit` grid, so an in-grid link becomes a stray
      cell), labelled `Show all N` / `Show less`. Click toggles
      `state.capabilitiesExpanded[group.kind]` and re-renders the mount it lives
      in. `+N more` moves behind the expanded check.
- [x] `media/chat.css` — `.capability-expand`: full-width, centred, link-coloured,
      no `@media` (the standing `zoom` rule).
- [x] `test/webview-helpers.test.ts` — featured-first ordering, case-insensitive
      match, `featuredCount` correctness, fallback when nothing matches, group
      smaller than the fallback, unknown kind.
- [x] `test/capabilities.dom.test.ts` — collapsed by default (hidden rows absent
      from the DOM, not merely styled away), expand reveals them, label flips,
      state survives a `setBusy` re-render, the toggle group gets no link, both
      mounts behave identically.
- [x] `CLAUDE.md` § Chat surfaces → capability browser: document the featured
      partition + expand link and the decisions above.

## Verification

`npm test` (1291+ floor, green) and `tsc -p . --noEmit` clean. No host/ACP change,
no new setting, no new message type.

## Non-goals

- No setting to configure the featured list (YAGNI — it is one data literal).
- No change to `src/capabilities.ts`, the host scan, or `CAPABILITY_GROUP_CAP`.
- No persistence of expansion across tabs or reloads.
