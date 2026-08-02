# Survey — Grokbit Actions: workflows only, as readable tiles

Every claim below was confirmed by opening the cited file in this session.
Line numbers are against the working tree at survey time (15 uncommitted files,
none of them in the capability-browser path except `media/chat.js`, whose only
uncommitted change is a 1-line edit unrelated to this area).

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| `CapabilityKind` union (`command`/`skill`/`agent`/`grokbit`) | EXISTS | `src/capabilities.ts:38` |
| `CAPABILITY_KIND_ORDER` (`["grokbit","skill","agent","command"]`) | EXISTS | `src/capabilities.ts:82` |
| `CAPABILITY_KIND_LABELS` (host copy) | EXISTS | `src/capabilities.ts:84` |
| `CAPABILITY_DESCRIPTION_MAX_CHARS = 160` | EXISTS | `src/capabilities.ts:169` |
| `truncateDescription` (host-side clip) | EXISTS | `src/capabilities.ts:333` |
| `capabilityFromSkillFile` (applies the 160 cap) | EXISTS | `src/capabilities.ts:369`, cap applied at `:389` |
| `CAPABILITY_GROUP_CAP = 100` | EXISTS | `src/capabilities.ts:166` |
| `buildCapabilityGroups` (emits one group per kind, in `CAPABILITY_KIND_ORDER`) | EXISTS | `src/capabilities.ts:733`, loop at `:746`, push at `:749` |
| `SUITE_SKILL_NAMES` (the four workflows, pipeline order) | EXISTS | `src/skill-suite.ts:47` |
| `applySuiteKind` (re-keys provisioned suite items to `grokbit`) | EXISTS | `src/skill-suite.ts:145`; sets `source: "Grokbit"` at `:160` |
| Host `listCapabilities` (scan → `applySuiteKind` → `buildCapabilityGroups` → post) | EXISTS | `src/sidebar.ts:3114`–`3165`; `buildCapabilityGroups` call at `:3152`; posts at `:3154`/`:3163` |
| `#capabilities-btn` markup + `title` attribute | EXISTS | `src/sidebar.ts:4652` |
| `#capabilities-popover` markup | EXISTS | `src/sidebar.ts:4655` |
| `#capabilities-panel` markup | EXISTS | `src/sidebar.ts:4672` |
| `capabilityGroupsView` (pure view model, both mounts) | EXISTS | `media/webview-helpers.js:753` |
| `partitionFeatured` (featured-first ordering) | EXISTS | `media/webview-helpers.js:690` |
| `CAPABILITY_FEATURED` map | EXISTS | `media/webview-helpers.js:658`; `grokbit` entry at `:659` |
| `CAPABILITY_FEATURED_FALLBACK = 5` | EXISTS | `media/webview-helpers.js:678` |
| `CAPABILITY_ROW_DESCRIPTION_MAX = 140` | EXISTS | `media/webview-helpers.js:617` |
| `truncateCapabilityDescription` (hard mid-word clip + "…") | EXISTS | `media/webview-helpers.js:618`–`622` |
| `CAPABILITY_KIND_LABELS` (webview copy) | EXISTS | `media/webview-helpers.js:606` |
| `sessionToggleGroup` (Auto-accept, popover only) | EXISTS | `media/webview-helpers.js:576` |
| `buildCapabilityRow` (renders one row) | EXISTS | `media/chat.js:762` |
| `buildCapabilityToggleRow` | EXISTS | `media/chat.js:732` |
| `appendCapabilityGroups` (slices on `featuredCount`, appends expand link) | EXISTS | `media/chat.js:870` |
| `renderCapabilitiesPanel` (welcome-canvas mount) | EXISTS | `media/chat.js:941` |
| `renderCapabilitiesPopoverBody` (popover mount) | EXISTS | `media/chat.js:990` |
| `CAPABILITIES_HEADING` / `CAPABILITIES_EXPLAINER` | EXISTS | `media/chat.js:710`, `:711` |
| Welcome-canvas empty-state string | EXISTS | `media/chat.js:980` — "No skills installed yet — just describe what you want in the message box." |
| Popover empty-state string | EXISTS | `media/chat.js:1027` — "No skills, commands, or agents found." |
| `state.capabilitiesExpanded` | EXISTS | `media/chat.js:83`; cleared at `:2500` |
| `.capability-group-items` (auto-fit grid, `minmax(min(100%,260px),1fr)`, `gap: 2px 14px`) | EXISTS | `media/chat.css:1979`–`1983` |
| `.capability-row` (flex column, `gap:1px`, `padding:5px 6px`, no border) | EXISTS | `media/chat.css:1984`–`1991` |
| `.capability-row-desc` (`white-space: nowrap` + ellipsis — the single-line clip) | EXISTS | `media/chat.css:2035`–`2041` |
| `.capability-row-name` (nowrap + ellipsis) | EXISTS | `media/chat.css:2018` |
| `.capability-row-hint` (nowrap + ellipsis) | EXISTS | `media/chat.css:2044` |
| `.capability-row-source` badge | EXISTS | `media/chat.css:2057` |
| `.capability-more` ("+N more") | EXISTS | `media/chat.css:2067` |
| `.capability-expand` (Show all / Show less) | EXISTS | `media/chat.css:2080` |
| `.welcome-grid > .capabilities-panel` (`flex: 1 1 min(100%,300px)`) | EXISTS | `media/chat.css:1835` |
| `.capabilities-panel` container | EXISTS | `media/chat.css:1887` |
| Bundled skill frontmatter descriptions | EXISTS | `resources/skills/{grokbit-plan,grokbit-implement,grokbit-test,grokbit-document}/SKILL.md`, line 3 of each |
| A `workflow` CapabilityKind / discovery source | DOES NOT EXIST | `src/capabilities.ts:30`–`31` explicitly documents it as deferred; searched `workflow` across `src/` |
| A setting for which capability kinds render | DOES NOT EXIST | searched `showCapabilities`, `capabilit` in `package.json` `contributes.configuration`; only the boolean `grok.showCapabilities` exists |
| A sentence-aware truncation helper anywhere in the repo | DOES NOT EXIST | searched `lastIndexOf(". ")`, `sentence`, `truncat` across `src/` and `media/` — only the two hard-clip helpers above |

## Reusable code

Highest-value section — this is what stops reinvention.

- **`capabilityGroupsView`** — `media/webview-helpers.js:753` — the ONE pure
  chokepoint both mounts already pass through (`media/chat.js:972` for the
  panel, `:1023` for the popover). Any group-level filter applied here covers
  both mounts with zero renderer change; a filter applied in
  `appendCapabilityGroups` (`media/chat.js:870`) would not, because
  `sessionToggleGroup`'s group also flows through that function
  (`media/chat.js:1007`) and must survive.
- **`partitionFeatured`** — `media/webview-helpers.js:690` — already orders the
  four suite items into `SUITE_SKILL_NAMES` pipeline order via
  `CAPABILITY_FEATURED.grokbit` (`:659`), and already yields
  `featuredCount === items.length` for that group, which is why the suite renders
  whole with no expand link. Still load-bearing after this change; do not delete.
- **`truncateCapabilityDescription`** — `media/webview-helpers.js:618` — the one
  place a description is shaped for display. Both `description` and `hint` go
  through it (`:765`, `:771`), so a change here covers both.
- **`.capability-group-items` auto-fit grid** — `media/chat.css:1979` — already
  an intrinsic multi-column grid with the mandatory `min(100%, …)` clamp. Tiles
  need a wider min track and a bigger gap, not a new layout mechanism.
- **`.capability-row-source` badge idiom** — `media/chat.css:2057` — the
  VS Code `--vscode-badge-*` chip pattern, reused from `.history-row-backend`.
- **`.session-setup-card` border/background recipe** — `media/chat.css:1846`–
  `1858` (`--vscode-editorWidget-background` + `--vscode-editorWidget-border` +
  `var(--radius, 6px)`) — the existing card look a tile should match rather than
  invent.
- **Existing DOM test harness** — `test/capabilities.dom.test.ts` already has
  `bootWebview` / `sendCapabilities` / `panelOf` / `popoverOf` / `click`
  helpers and a `SUITE_GROUP` fixture (`test/capabilities.dom.test.ts:59`–`69`)
  driving the real `media/chat.js`.
- **CSS source-check idiom** — `test/capabilities.dom.test.ts:507`, `:767` read
  `chat.css` as text and assert rule ordering/content. This is how a CSS-only
  invariant gets an executable guard in this repo.

## Supersession

What this change replaces, duplicates, or makes dead. Caller counts confirmed by
grep over `src/`, `media/`, `test/`; none needed capping.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Welcome-canvas empty-state string "No skills installed yet…" | `media/chat.js:980` | 1 | Names "skills"; after the change the panel lists only workflows, so the wording is wrong in the one state where it shows |
| Popover empty-state string "No skills, commands, or agents found." | `media/chat.js:1027` | 1 | Same — names three kinds that can no longer appear |
| `#capabilities-btn` `title="Grokbit workflow, skills, commands & agents"` | `src/sidebar.ts:4652` | 1 | Tooltip promises three kinds the button no longer opens |
| `.capability-row-desc` `white-space: nowrap` + `text-overflow: ellipsis` | `media/chat.css:2038`–`2040` | — (CSS) | Directly implements the single-line clip the request is asking to remove |
| `CAPABILITY_ROW_DESCRIPTION_MAX = 140` hard mid-word clip | `media/webview-helpers.js:617`–`622` | 2 (`description`, `hint` — both in `capabilityGroupsView`) | 140 chars, cut mid-word with "…", cannot satisfy "complete sentences" |
| `CAPABILITY_DESCRIPTION_MAX_CHARS = 160` (host) | `src/capabilities.ts:169`, applied `:389` | 1 (`truncateDescription` default) | Clips **before** the webview ever sees the text, so raising only the webview cap changes nothing |
| `CAPABILITY_FEATURED.skill` / `.agent` / `.command` entries | `media/webview-helpers.js:660`–`671` | 1 (`partitionFeatured`) | Those kinds no longer render, so the entries stop having a visible effect (the `grokbit` entry at `:659` stays load-bearing) |
| `.capability-expand` link + `state.capabilitiesExpanded` | `media/chat.js:895`–`919`, `:83`, `:2500`; CSS `media/chat.css:2080` | renderer-internal | `grokbit` has `featuredCount === items.length` (4 of 4), so `group.items.length > featuredCount` is never true for the only surviving group |
| `.capability-more` "+N more" overflow label | `media/chat.js:888`–`893`; CSS `media/chat.css:2067` | renderer-internal | The suite has 4 items against `CAPABILITY_GROUP_CAP = 100`, so `remaining` is always 0 |
| `.capability-row-source` badge + `workspaceSource` flag | `media/chat.js:788`–`797`; `media/webview-helpers.js:776`; CSS `media/chat.css:2057` | renderer-internal | `applySuiteKind` stamps `source: "Grokbit"` (`src/skill-suite.ts:160`), which does not start with `"Project"`, so the badge can never render for a suite item |
| `capabilityGroupsView`'s "iterates the supplied groups ARRAY in the order given — no fixed keys, no three-kind branching" contract | `media/webview-helpers.js:713`–`718` (doc comment) | — (doc) | A visibility filter changes what that comment promises; leaving it stale would make the next reader trust a contract the code no longer honours |

## Prior attempts

- **Featured-capabilities collapse** — `docs/plans/actions-panel-featured-capabilities.md`,
  shipped as `partitionFeatured` + the expand link. This is a *previous, milder
  answer to the same complaint* ("the menu is a wall of rows"): it kept every
  group but showed only a featured subset of each. The live code uses it. This
  change supersedes its purpose for three of the four kinds while keeping its
  ordering role for `grokbit`.
- **`74e923a` welcome-canvas chrome removal** — removed `#welcome-starters` /
  `.welcome-starter` / `.welcome-task-chip`; `test/friendly-ui.dom.test.ts`
  guards against resurrecting them. Precedent that *deleting* welcome-canvas
  surfaces is an accepted move in this repo, and that the guard is a source
  check.
- No abandoned "workflow tiles" or "capability card" implementation exists —
  searched `tile`, `card` across `media/`; the only `*-card` classes are
  `.session-setup-card`, `.plan-card`, `.doc-card`, `.question-card`, none of
  them capability-related.

## Conventions

- **Pure/impure split:** display policy lives in `media/webview-helpers.js`
  (pure, exported at `:1183`, unit-tested in `test/webview-helpers.test.ts`);
  DOM construction lives in `media/chat.js`; host scanning in
  `src/capabilities.ts` (pure) + `src/sidebar.ts` (the only real-`fs` caller,
  `capabilityFs` at `src/sidebar.ts:3095`).
- **Data, not logic:** cross-cutting choices are module-level constant maps with
  a long comment (`CAPABILITY_FEATURED` at `media/webview-helpers.js:658`,
  `CAPABILITY_KIND_ORDER` at `src/capabilities.ts:82`), never `if (kind === …)`
  in the renderer. `buildCapabilityRow` branches on `item.control`
  (`media/chat.js:766`) explicitly to avoid branching on kind.
- **Tests:** vitest, `test/*.test.ts`, happy-dom for `*.dom.test.ts` driving the
  real `media/chat.js`; `[R]` prefixes a regression test that guards a specific
  documented decision (e.g. `test/capabilities.dom.test.ts:87`, `:836`).
- **CSS:** VS Code theme tokens only, no hardcoded colors
  (`media/chat.css:2063` is the badge example); no `@media` queries anywhere —
  the file states the rule at `media/chat.css:1821`–`1822` and a source check
  counts the literal at-rule token.
- **Comments carry the *why*** and cite the plan doc that decided it — e.g.
  `media/chat.js:896`–`898` explains why the expand link is a sibling of the
  grid, not a child.
- **Docs:** a behaviour change of this size updates `CLAUDE.md` § Chat surfaces
  and adds a `CHANGELOG.md` entry; a decision with a standing "someone will try
  to revert this" risk gets an ADR in `docs/adr/` (`0002` covers the session-tab
  layout policy this touches).

## Absences

- **No visual/screenshot test.** Nothing in the suite asserts rendered
  geometry — happy-dom does not lay out. "Tiles have enough room" is therefore
  not directly assertable; it can only be checked as CSS source facts (no
  `nowrap` on the description, a bordered `.capability-row`, a wider grid track)
  plus a human look. This is a real verification gap and the plan handles it as
  a CSS source check plus an explicit manual step, not by pretending otherwise.
- **No `@media`/container-query support in the current CSS** — by policy, not
  by omission. Any responsive behaviour must be intrinsic.
- **No existing test for the two empty-state strings' exact wording** — the
  popover one is asserted at `test/capabilities.dom.test.ts:~697`; the
  welcome-canvas one is not asserted anywhere found.
- **No CI job runs `npm run test:live`** — it is a manual pre-release gate
  (`package.json` `test:live`), and it does not exercise the webview.

## Danger zones

- **`media/chat.js`** — ~5300 lines, the single largest webview file, already
  carrying an uncommitted change. The capability-browser code is threaded
  through four lifecycle anchors (`initialized`, `setBusy`, `showOnboarding`'s
  four branches, `clearWelcome`/`resetForNewSession`) at `:5078`, `:2464`,
  `:2493`, `:2538`, `:2556`, `:2574`, `:2589`, `:5012`. Changing render-time
  behaviour without touching those anchors is required.
- **`test/capabilities.dom.test.ts`** — ~870 lines, already uncommitted-modified
  (+48 lines). It is the primary guard for this whole feature, and several of
  its blocks feed `skill`/`agent`/`command` groups and assert rows render
  (`:117`–`:124`, `:129`–`:165`, `:188`–`:199`, `:571`, `:675`–`:683`,
  `:790`–`:860`). A group-visibility filter breaks these by construction — they
  must be retargeted onto `grokbit` fixtures, not deleted, or the generic
  renderer machinery is left untested.
- **`media/chat.css`** — `.capability-row` is shared by `.capability-row-toggle`
  (`media/chat.css:2006`), which renders the Auto-accept switch in the popover.
  Tile styling applied to the bare `.capability-row` selector also restyles that
  switch row.
- **`src/capabilities.ts`** — pure and heavily tested
  (`test/capabilities.test.ts`, incl. a truncation test at `:232`). Raising
  `CAPABILITY_DESCRIPTION_MAX_CHARS` affects every kind's payload, not just the
  suite.
- **`docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md`** — records the
  welcome-canvas width/intrinsic-sizing policy this change's CSS must not
  violate.
