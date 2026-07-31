# Actions panel: close the layout gap, refresh capabilities on demand, and (fork) toggle-shaped actions

**Status:** planned — open questions A and B answered 2026-07-30; both packages cleared to start

**Decisions (2026-07-30):**
- **A — equal heights: YES.** The two panels form one flush rectangle. `.welcome-grid` uses
  `align-items: stretch`, not `flex-start`. See § Thread 1 and the inverted R2 guard test.
- **B — toggle mount: (i) Actions popover only.** No toggle on the welcome canvas, where the Session
  Setup card's Mode row already sits beside it. WP2 ships as written; **no ADR 0003 needed**.
**Request:** *"There is a large gap between Session Setup and Actions panels. Let's make the Actions
panel extend all the way to the Session Setup panel. Also the actions might be different per user who
has it installed. Some actions, like auto-approve could possibly be a toggle. Also we should not hard
code actions as they may be different for each user. Can we load actions on the fly based on what the
user has available for Claude or Grok"*

Three separable threads. Thread 1 is a real, arithmetically-explainable CSS defect. Thread 2 is
**mostly already true** — discovery is per-user and dynamic today — with two genuine residual gaps.
Thread 3 was a genuine design fork; it has been decided (popover-only mount, see Decisions above).

Prior art this must stay consistent with: `docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md`,
`docs/plans/session-tab-ux-overhaul.md`, `docs/plans/capability-surfacing-and-history-ux.md`,
`docs/plans/claude-code-backend.md`, and CLAUDE.md § Chat surfaces.

---

## Goal

1. **Close the gap.** The Actions panel (`#capabilities-panel`) sits flush beside the Session Setup
   card (`#session-setup-card`) — separated by the 10px gutter and nothing else — absorbs all
   remaining canvas width at every tab width above the point where the two fit side by side, and
   (decision A) shares its height so the pair reads as one flush rectangle.
2. **Make "loaded on the fly" visibly true.** Add the one refresh path that is genuinely missing (a
   user who adds/edits a skill while looking at a live welcome canvas has no way to see it appear),
   and stop the group cap silently swallowing a power user's skills.
3. **Ship toggle-shaped actions** — starting with auto-accept, in the Actions popover (decision B) —
   inside the same data-driven `CapabilityGroup[]` pipeline, sourced from existing session state and
   existing messages, never from a fourth copy of the truth.

## Non-goals (explicit)

- **Not** re-litigating what is discoverable. MCP servers (grok's live in `config.toml`; no TOML
  parser and none wanted), personas (`.grok/personas/*.toml`, grok-only), plugins (two different
  marketplace layouts + enable/disable state), and workflows (neither CLI loads `.grok/workflows/*`)
  stay out — see `docs/plans/capability-surfacing-and-history-ux.md` § Non-goals and CLAUDE.md
  § Known limits. Nothing here adds a `CapabilityKind` for any of them.
- **Not** adding namespaced-subdirectory command discovery (`.claude/commands/frontend/x.md` →
  `/frontend:x`). Real for Claude Code, unverified for grok, and no such directory exists on this
  machine to validate against. Deferred; noted as a known limit rather than guessed at.
- **Not** walking every directory between cwd and repo root (grok's `08-skills.md` says it does;
  we scan workspace root + home only). In VS Code, workspace root ≈ cwd ≈ repo root; documented as a
  limit, not fixed.
- **Not** a `@media` query, anywhere, ever (ADR 0002 — `body { zoom: var(--chat-zoom) }` makes
  breakpoints lie at every non-default `grok.chatFontScale`). Container queries only, if any — and
  this plan needs none.
- **Not** removing or narrowing the Session Setup card's 420px form measure, and **not** centring
  anything. The `95ch` left-aligned prose rule stays exactly as ADR 0002 fixed it.
- **Not** changing `CAPABILITY_KIND_ORDER`'s existing three entries or their order
  (`skill` → `agent` → `command`), and **not** teaching `chat.js` to branch on kind strings.
- **Not** a filesystem watcher over capability roots (see Open question C).
- **Not** touching the status-bar HUD, the launcher, history pagination, or the gear popover's
  existing switches.
- No commits, no pushes, no release. Local rebuild only if the user asks.

---

## What is actually true today (measured, not assumed)

### Thread 1 — the gap is `.welcome-grid`'s track sizing vs. the card's own cap

`src/sidebar.ts`'s `getHtml` emits:

```html
<div id="welcome-grid" class="welcome-grid">
  <div id="session-setup-card" class="session-setup-card" hidden></div>
  <div id="capabilities-panel" class="capabilities-panel" hidden></div>
</div>
```

`media/chat.css`:

```css
.welcome-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 10px;
  align-items: start;
}
.welcome-grid > .session-setup-card { max-width: 420px; } /* form measure */
```

`auto-fit` collapses the empty repetitions, so with exactly two children there are always **two
non-empty `1fr` tracks**, each `(W − 10) / 2` wide. The Actions panel fills its track; the Session
Setup card is capped at **420px** inside a track that keeps growing. The visible gap is therefore

```
gap(W) = (W − 10)/2 − 420 + 10        (zero until the track reaches 420px)
```

- `W ≤ 850px` → track ≤ 420px → **no gap** (this is why it has never been noticed in a split editor).
- `W = 1200px` → track 595px → **~185px gap**.
- `W = 1920px` → track 955px → **~545px gap**.

So the gap opens at ~850px of tab width and then grows at half the rate of the tab. That matches the
report exactly. Nothing else contributes: `.welcome` is a centred flex column but `.welcome-grid` has
`width: 100%`; `align-items: start` only affects block-axis alignment; neither panel has a `height`
or `max-height`; and both panels are `display: flex; flex-direction: column` internally with
`min-width: 0`.

**"Extend all the way to the Session Setup panel" is read as both axes** (decision A): horizontally
the Actions panel begins one gutter after the card's right edge and runs to the canvas edge;
vertically the two share a height, so the pair reads as one flush rectangle rather than two cards of
different lengths.

### Thread 2 — discovery is already dynamic and per-user; three things are not

Verified by reading `src/capabilities.ts`, `src/sidebar.ts`'s `listCapabilities`, and every
`listCapabilities` call site in `media/chat.js`:

**Already per-user, already on the fly (no change needed, and worth saying out loud in the reply):**

- `scanCapabilityRoots` walks `CAPABILITY_ROOTS[session.backend]` on the **user's own disk** at
  request time — workspace tier and home tier, per backend *and per kind*. Nothing about the row
  content is baked into the extension.
- `mergeAcpCommands` folds in `AcpClient.availableCommands`, i.e. the **running CLI's own** live
  slash-command list, and the host re-posts the whole payload on every `commandsUpdate`.
- `buildCapabilityGroups` omits empty kinds entirely, so a user with no agents sees no Agents group.
- The grok/Claude root asymmetry (`.agents/*`, `.cursor/skills` and the `.claude` vendor-compat dirs
  for grok; `.claude/*` only for Claude) is **correct by construction** — each list mirrors that
  CLI's own documented search path (`~/.grok/docs/user-guide/08-skills.md` § Skill Locations vs.
  Claude Code's `.claude/{skills,commands,agents}`). It is not an omission to "fix".
- `grok.showCapabilities: false` already disables the feature end to end (host gate before any scan,
  two independent webview re-checks, button hidden with an explicit `display:none`).

**Genuinely still hardcoded or missing:**

1. **`GROK_BUILTIN_AGENTS(backend)`** — a literal three-item list (`general-purpose`, `explore`,
   `plan`) with hand-written descriptions, rendered **inert** (no `invoke`, no `path`, no click
   handler). It is the only literal capability list in the codebase, it is the least useful thing on
   the panel, and it is plausibly what prompted "we should not hardcode actions". It is *also*
   genuinely per-backend (empty for Claude) and genuinely real (grok's documented `spawn_subagent`
   types, which no ACP surface enumerates). See Open question D.
2. **No refresh path for the live welcome panel.** `listCapabilities` is requested from exactly four
   places: the `initialState` handler (fires on `ready` and on every reveal of a torn-down hidden
   panel), the `showCapabilities: true` broadcast, `openCapabilitiesPopover()`, and the host's own
   `commandsUpdate` re-post. A user sitting on a visible welcome canvas who writes
   `.grok/skills/foo/SKILL.md` — by hand or by asking the agent to — sees nothing change until they
   switch tabs and back. The top-bar Actions popover re-requests on every open, so mid-session is
   fine; the canvas is the hole.
3. **`CAPABILITY_GROUP_CAP = 40` truncates with a dead end.** `+N more` is a muted `<p>` with no
   action. A user with 60 skills is told 20 of their own capabilities exist and given no way to reach
   them from either mount. Both mounts scroll, and `CAPABILITY_SCAN_FILE_CAP = 300` already bounds
   the real work, so the cap is doing very little except hiding user content.

### Thread 3 — "auto-approve as a toggle" collides with three existing surfaces

Auto-accept is not an action; it is one value of a **tri-state mode** (`agent` / `plan` / `yolo`,
derived host-side by `displayMode(session)` from `planActive` + `autoApprove`). It is already
reachable from three places in a session tab:

- the composer mode button (`updateModeBtn` / the mode popover),
- the Session Setup card's **Mode** segmented row (`sessionSetupModel`'s `mode` row — the labels are
  literally `Agent` / `Plan` / `Auto accept`), and
- the composer quick-settings popover, which renders that same row from the same builder.

All three read `state.currentModeId` and post `{type:"setMode", modeId}`; the host acks with
`modeChanged`, and `chat.js`'s handler already calls `refreshSessionSettingsMounts()` +
`renderWelcomeGuide()`. So a fourth surface is cheap to keep in sync **only if** it renders from
`state.currentModeId` and posts `setMode` like the others — and expensive/wrong if it invents its own
state or a new message.

The sharp edge: **a two-state switch cannot represent a tri-state mode.** "Auto-accept: off" is
ambiguous (Agent? or back to Plan?). Any toggle must define the OFF target explicitly and define what
it shows while the session is in Plan mode.

The duplication problem is real and specific: on the welcome canvas, the Session Setup card sits
*directly beside* the Actions panel. Putting an auto-accept switch in the Actions panel there means
two controls for one piece of state, side by side, on the same screen.

---

## Approach

### Thread 1 — one flex-wrap line replaces the two-`1fr`-track grid

**Chosen:** make `.welcome-grid` a wrapping flex row; give the setup card a capped, growable basis
and the Actions panel an uncapped growable basis.

```css
.welcome-grid {
  width: 100%;
  text-align: left;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: stretch;   /* decision A — the two panels form one flush rectangle */
}
.welcome-grid > .session-setup-card { flex: 1 1 min(100%, 300px); max-width: 420px; }
.welcome-grid > .capabilities-panel { flex: 1 1 min(100%, 300px); min-width: 0; }
```

Why this exact shape — it is **provably behaviour-preserving below the gap threshold and
gap-closing above it**, which is the property that makes it a safe edit to a rule ADR 0002 froze:

| Tab width `W` | Today (grid) | After (flex-wrap) |
|---|---|---|
| `W < 610` | 1 track → stacked; card capped 420 | bases 300+300+10 > W → wraps → stacked; card capped 420 — **identical** |
| `610 ≤ W ≤ 850` | 2 tracks of `(W−10)/2` ≤ 420 → card fills its track | one line; both grow equally to `(W−10)/2` ≤ 420 → **identical** |
| `W > 850` | 2 tracks of `(W−10)/2` > 420 → card frozen at 420, **gap grows** | card freezes at its `max-width: 420px`, remaining free space redistributes to the Actions panel → **10px gutter, no gap** |

There is no discontinuity at `W = 850`: the card grows smoothly to 420 and then stops while the panel
keeps growing. `min-width: 0` is already present on both panels, so the shrink path at a ~250px
split-editor tab is unchanged and cannot overflow; the `min(100%, …)` basis keeps the ADR's clamp
idiom (and the source-check tests' grep) intact.

`.capability-group-items` is **untouched** — it stays `repeat(auto-fit, minmax(min(100%, 260px), 1fr))`.
The whole point is that a wider Actions panel now produces *more columns of real rows*, which is
exactly ADR 0002's stated intent; the gap fix is what finally lets that grid do its job.

**Main alternative considered — drop `max-width: 420px` and let both cards fill their `1fr` tracks.**
One-line change, no grid→flex conversion, gap gone. Rejected: the 420px cap is a deliberate *form*
measure (label / control pairs at 900px put the control an inch away from its label); removing it
converts a gap complaint into a stretched-form complaint, and it would leave the two cards permanently
equal-width, which is wrong when one holds four rows and the other holds forty.

**Second alternative — a container query on `.welcome`** (`container-type: inline-size`) switching to
an explicit `420px 1fr` two-track grid above a threshold. Legal under ADR 0002 (container queries
resolve in the zoomed box), but it re-introduces a threshold the flex solution derives for free from
the card's own max-width, and adds a `container-type` to a scroll ancestor for no gain. Rejected as
more machinery for the same result.

**Vertical alignment becomes `stretch`** (decision A), replacing today's `align-items: start`. Both
panels take the taller one's height — normally the Actions panel's — so the Session Setup card's
border box extends past its own footer and the pair reads as one flush rectangle. This is a
deliberate reversal of the plan's original recommendation, made explicitly by the user.

Two consequences to implement against, neither of which is a regression:

- **The dead space lands *inside* the Session Setup card**, below its footer. Its content must stay
  pinned to the top of that taller box — the card is already `display: flex; flex-direction: column`,
  and flex's own default `justify-content: flex-start` gives exactly that, so nothing extra is
  needed. Do **not** add `justify-content: space-between` or a growing spacer to "fill" it; that
  would drag the footer to the bottom of an arbitrarily tall box, which is a different (and worse)
  layout than what was asked for.
- **The stacked path is untouched.** `align-items` applies per flex *line*; once the two panels wrap
  onto separate lines each is alone on its line, so its line's cross-size is its own content height
  and `stretch` is a no-op. The narrow-tab behaviour in the width table above therefore still holds
  byte-for-byte.

### Thread 2 — a refresh affordance, a bigger cap, and honest documentation

**Chosen:**

1. **A `Refresh` affordance on both mounts.** The panel's heading becomes a small flex head
   (`.capabilities-head`) holding the existing `.capabilities-heading` text plus a
   `.capabilities-refresh` text button; `renderCapabilitiesPopover`'s `.studio-popover-head` gets the
   same button. Click posts the **existing** `{type:"listCapabilities"}` message — no new message
   type, no new host method, and the existing `showCapabilities` host gate covers it unchanged. The
   button is not rendered while `locked` (the priming window), for the same reason rows aren't
   clickable then.
2. **Raise `CAPABILITY_GROUP_CAP` 40 → 100.** `CAPABILITY_SCAN_FILE_CAP = 300` still bounds the
   actual disk work; both mounts scroll; 100 rows of three spans each is nothing next to the
   transcript DOM. `+N more` stays for the genuine tail and keeps its `total`-derived wording.
3. **Documentation, not code, for the rest.** `GROK_BUILTIN_AGENTS` stays (Open question D), and
   the intermediate-directory walk plus namespaced command subdirectories go into CLAUDE.md
   § Known limits so the next reader doesn't re-derive them.

**Main alternative — a `vscode.FileSystemWatcher` over the capability roots** (workspace roots via a
plain glob; home roots via `RelativePattern(Uri.file(homeDir), …)`), re-posting `listCapabilities` to
every live session on create/change/delete. It is the only thing that catches the agent writing a
skill through `fs/write_text_file` (which fires no `onDidSaveTextDocument`). Rejected **for now**:
it is a persistent OS-level watcher on `~/.grok/**` and `~/.claude/**` for a panel that is visible
only on an empty tab, it needs per-backend root→glob translation and disposal wiring, and the manual
button covers every case the user can actually observe. Recorded as Open question C so it is a
decision, not an oversight.

### Thread 3 — toggle rows as a shape, not a new kind (design fork — see Open question B)

**Chosen mechanism (if the fork is approved):** a **toggle row shape** inside the existing
`CapabilityGroup[]` pipeline, built by a new pure webview builder from state the webview already
holds, and posting messages that already exist.

- New pure builder `sessionToggleGroup({ backend, modeId, locked })` in `media/webview-helpers.js`,
  returning a group in the same shape `capabilityGroupsView` emits:
  `{ kind: "toggle", title: "Session controls", items: [...], total: n }`, where each item carries
  `{ toggleId, label, description, control: "switch", on, locked }`.
- `buildCapabilityRow` gains **one** branch keyed on `item.control === "switch"` — deliberately *not*
  on `item.kind`, preserving the standing rule that the renderer never branches on kind strings. The
  switch reuses the gear popover's existing `.popover-switch` / `.popover-switch-knob` markup and CSS
  (`role="switch"`, `aria-checked`), so no new control CSS is invented.
- Clicking posts through a small `applyCapabilityToggle(toggleId, next)` that mirrors
  `pickSessionSetting`'s existing rowId→message mapping. **No new message types.**
- **The host never produces this group.** It is appended by the webview at render time, so it can
  never be stale relative to `modeChanged`, and `src/capabilities.ts` / `listCapabilities` /
  `CapabilityKind` are untouched.

**v1 content is exactly one toggle: Auto-accept.** Semantics, stated explicitly because the tri-state
mapping is the part that goes wrong:

| Current `state.currentModeId` | Switch renders | Click posts |
|---|---|---|
| `yolo` | **on** | `{type:"setMode", modeId:"agent"}` |
| `agent` | off | `{type:"setMode", modeId:"yolo"}` |
| `plan` | off, with the description reading that turning it on leaves Plan mode | `{type:"setMode", modeId:"yolo"}` |

Turning it on from Plan is *allowed* (the host's `setMode("yolo")` already drops `planActive`, and the
Mode segmented control already permits that exact transition) — a disabled switch here would be a
different behaviour from the control right next to it. The row is `locked` (no handler, no hover)
whenever `state.busy`, matching every other row and matching the host's own `setMode` no-op during
priming.

**Mount policy — decided (Open question B, answered (i)):**
the toggle group renders in the **top-bar Actions popover only**, *not* on the welcome-canvas panel.
Rationale: on the canvas the Session Setup card's Mode row is three inches away, so a switch there is
two controls for one state on one screen; in the popover — the mid-session door, opened when the
welcome canvas is long gone — it is the only reachable copy besides the composer's mode button. It
renders **first** in the popover (a two-row fixed group above a long scrollable skills list), and
renders even when discovery is empty or has not arrived (`"Scanning…"` / `"No skills…"` must not
suppress it — an explicit edge case, tested).

**Main alternative — a bare "Auto-accept" switch pinned in the composer toolbar** next to the mode
button. Rejected: it is a strictly-worse duplicate of the mode button that sits beside it, and it
would need its own tri-state reconciliation with that button on every `modeChanged`.

**Second alternative — pull `grok.showThinking` / `grok.compactActivity` into the same group.**
Rejected for v1: both are *global config*, not per-session state; they already have a coherent home
in gear → Config & debug; and mixing window-wide settings into a per-tab "Session controls" group
teaches the wrong mental model. The mechanism supports them later if asked.

---

## Change surface

### `media/chat.css`
- `.welcome-grid` — grid → wrapping flex row (`display:flex; flex-wrap:wrap; gap:10px;
  align-items:stretch`), keeping `width:100%` and `text-align:left`. Replace the ADR-0002 comment
  block above it with one that states the new invariant (`min(100%, …)` basis, `stretch` is the
  deliberate equal-height choice, no `@media`) and the arithmetic reason the old rule gapped.
- `.welcome-grid > .session-setup-card` — `flex: 1 1 min(100%, 300px); max-width: 420px;` (the
  420px form measure survives verbatim).
- **New** `.welcome-grid > .capabilities-panel` — `flex: 1 1 min(100%, 300px); min-width: 0;`.
- **New** `.capabilities-head` (flex row, `justify-content: space-between; align-items: baseline`)
  and `.capabilities-refresh` (borderless text button, `--vscode-textLink-foreground`, `:hover`
  underline, `:focus-visible` outline matching `.muted-link`).
- **New** `.capability-row-toggle` (WP2 only) — a flex row placing the existing `.popover-switch`
  at the row's trailing edge; no new switch visuals.
- **Nothing else.** `@media` count stays at 2. `.capability-group-items` untouched.

### `media/chat.js`
- `appendCapabilitiesHeading(container, locked)` → builds the `.capabilities-head` wrapper and, when
  not locked, the `.capabilities-refresh` button whose handler posts `{type:"listCapabilities"}`
  (with `stopPropagation`, like every other in-popover click).
- `renderCapabilitiesPopover()` — same refresh button appended to the `.studio-popover-head`.
- `renderCapabilitiesPanel()` — pass `locked` into the heading builder; no gate changes.
- WP2 only: `buildCapabilityRow` gains the `item.control === "switch"` branch;
  `applyCapabilityToggle(toggleId, next)` added beside `pickSessionSetting`;
  `renderCapabilitiesPopoverBody()` prepends `sessionToggleGroup(...)`'s group (including on the
  `!cap` / `cap.error` / empty-groups paths); the `modeChanged` handler additionally re-renders the
  popover body when it is open (it already calls `refreshSessionSettingsMounts()`); `setBusy` and
  `backendChanged` likewise re-render the open popover body so the lock state follows.

### `media/webview-helpers.js`
- WP2 only: new pure `sessionToggleGroup(opts)` + its export in the `api` object. No change to
  `capabilityGroupsView`, `CAPABILITY_KIND_LABELS`, `sessionSetupModel`, or `welcomeGuide`.

### `src/capabilities.ts`
- `CAPABILITY_GROUP_CAP` 40 → 100, with the doc comment stating why (the scan cap is the real bound;
  `+N more` should be a rare tail, not the default experience for a power user).
- No other change. `CapabilityKind`, `CAPABILITY_KIND_ORDER`, `CAPABILITY_ROOTS`,
  `GROK_BUILTIN_AGENTS` all stay as they are.

### `src/sidebar.ts`
- **No functional change.** `listCapabilities` already handles the refresh button's request and is
  already gated on `showCapabilities()`. (Confirm during implementation that no `getHtml` markup
  change is needed — the refresh button is JS-created inside the panel, so `test/webview-harness.ts`'s
  `BODY` mirror needs no edit either.)

### Docs
- `CLAUDE.md` § Chat surfaces (capability-browser bullet): the refresh affordance and the raised
  group cap; the toggle group + its mount policy + the tri-state mapping if WP2 ships.
- `CLAUDE.md` § Known limits: no filesystem watcher (manual refresh only, and an agent-written skill
  needs that refresh); no namespaced command subdirectories; no intermediate-directory walk between
  cwd and repo root.
- `docs/architecture.md` § Design choices → "Capability browser: two mounts, one pure builder"
  (~line 327): refresh affordance; toggle group if WP2 ships.
- `docs/adr/0002-…md`: an **Amendment** section (see § ADR below).
- `CHANGELOG.md`: one terse `### Fixed` bullet for the gap, one `### Changed`/`### Added` for the
  refresh + cap, one `### Added` if WP2 ships.

---

## Test strategy

`npm test` is the floor (975+, grok-free and claude-free). happy-dom has **no layout engine**, so no
test can assert a computed pixel width — layout verification is source-text assertions on
`media/chat.css`, the technique `test/chat-layout.dom.test.ts` and `test/capabilities.dom.test.ts`
already use.

### `test/chat-layout.dom.test.ts` (rewrite two cases, add four)

- **Rewrite** `[R] .welcome-grid is an auto-fit grid clamped with min(100%, …)` → `[R] .welcome-grid
  is a wrapping flex row, not two equal 1fr tracks`: the rule contains `display: flex` and
  `flex-wrap: wrap`, and **must not** contain `repeat(auto-fit` (the two-`1fr`-track shape is exactly
  the defect).
- **New** `[R] the two welcome panels are equal-height (align-items: stretch)` — asserts
  `align-items: stretch` present and `flex-start`/`start` absent in the `.welcome-grid` rule
  (decision A; this is the inverted form of the guard the plan originally proposed).
- **New** `[R] the Session Setup card's content stays top-pinned in a stretched box` — asserts the
  `.session-setup-card` rule contains neither `justify-content: space-between` nor
  `justify-content: flex-end`, so the extra height opened by `stretch` can never push its footer to
  the bottom of an arbitrarily tall box.
- **New** `[R] the Actions panel is the growable child; the setup card keeps its 420px form measure`
  — `.welcome-grid > .capabilities-panel` contains `flex: 1 1` and `min-width: 0`;
  `.welcome-grid > .session-setup-card` contains both `flex: 1 1` and `max-width: 420px`.
- **New** `[R] both children clamp their flex-basis with min(100%, …)` — the narrow-split-tab
  overflow guard ADR 0002 exists to protect, restated for the flex form.
- **Keep unchanged and green**: the `@media` count `=== 2`, the `.capability-group-items` auto-fit
  assertions (in this file *and* the duplicate in `test/capabilities.dom.test.ts`), the `95ch`
  left-aligned prose rule, the launcher-isolation source check, the single-`#model-label` check, and
  the `#welcome-grid` parentage DOM check.

### `test/capabilities.dom.test.ts` (WP1 additions)

- Refresh button on the welcome panel: rendered when unlocked; clicking posts exactly one
  `{type:"listCapabilities"}` and **does not** clear or re-render away the existing rows.
- Refresh button **absent** while locked (the `initialState → initialized → capabilities →`
  still-busy window), present after `setBusy:false` — folded into the existing `[R]` lifecycle case
  rather than duplicating its whole sequence.
- Refresh button in the popover head: click posts `listCapabilities` and the popover **stays open**
  (the `stopPropagation` guard — the exact bug class this file already regression-tests twice).
- Regression: `showCapabilities:false` → the refresh button exists nowhere and no
  `listCapabilities` is posted from either mount.

### `test/capabilities.test.ts` (WP1)

- `buildCapabilityGroups` caps at the new `CAPABILITY_GROUP_CAP` and still reports the true pre-cap
  `total` — assert against the exported constant, never a literal `40`/`100`, so the constant stays
  the single source of truth.

### WP2 tests

`test/webview-helpers.test.ts` (pure `sessionToggleGroup`):
- `modeId: "yolo"` → the auto-accept item is `on: true`; `"agent"` → `on: false`; `"plan"` →
  `on: false` **and** the description mentions leaving Plan mode.
- `locked: true` → every item carries `locked: true`.
- Group shape is structurally what `appendCapabilityGroups` consumes (`kind`/`title`/`items`/`total`),
  so the renderer needs no special case beyond the switch branch.
- Returns the same group for `backend: "claude"` — auto-approve is a client-side gate, not a
  grok quirk.

`test/capabilities.dom.test.ts` (DOM, real `chat.js`):
- The popover renders the toggle group **first**, above the discovered groups.
- Clicking the switch in `agent` mode posts exactly `{type:"setMode", modeId:"yolo"}` — and nothing
  else (no `send`, no `openFile`, no `listCapabilities`).
- Clicking it while `on` posts `{type:"setMode", modeId:"agent"}`.
- A subsequent `{type:"modeChanged", modeId:"yolo"}` flips the rendered switch **without** a second
  click and **without** a `listCapabilities` re-request — the single-source-of-truth guarantee.
- `state.busy` → the switch renders locked with **no click handler at all** (posts nothing), matching
  `.inert`/`.locked` precedent.
- The toggle group still renders when `state.capabilities` is `null` ("Scanning…"), when
  `cap.error` is set, and when `groups: []` — three explicit cases, because each of those paths
  currently `return`s early.
- **Welcome-canvas panel renders no `.popover-switch`** — the executable guard for decision B's
  anti-duplication rationale (the Session Setup card's Mode row is the canvas's only mode control).

`test/session-setup.dom.test.ts` / `test/welcome-canvas.dom.test.ts` — must stay green untouched;
they are the guard that WP2 did not disturb the Mode row or the four lifecycle anchors.

### Verify commands

```bash
npx vitest run test/chat-layout.dom.test.ts test/capabilities.dom.test.ts test/capabilities.test.ts   # WP1
npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts test/session-setup.dom.test.ts test/welcome-canvas.dom.test.ts  # WP2
npx tsc -p . --noEmit
npm test
```

---

## Risks

- **R1 — the flex conversion silently changes narrow-tab behaviour.** Mitigated by design (the width
  table above shows byte-identical stacking below 610px and identical side-by-side sizing to 850px)
  and by the `min(100%, …)` + `min-width: 0` source-check tests. Manual check after rebuild: drag a
  session tab into a ~250px split and confirm no horizontal scrollbar at 100% and at 200%
  `grok.chatFontScale`.
- **R2 — the stretched Session Setup card grows dead space in the wrong place.** With decision A the
  shorter card is *meant* to be padded, but its own content must stay top-pinned; a stray
  `justify-content` on `.session-setup-card` (or a `flex: 1` on its footer) would strand the footer at
  the bottom of a very tall box on a wide, skill-rich canvas. Covered by the top-pinned source-check
  case. Note this risk is the mirror of the one the plan originally carried — `stretch` is now the
  asserted state, not the failure mode.
- **R3 — a refresh click that re-renders the panel while a payload is in flight** could flash an
  empty panel. It cannot today: `renderCapabilitiesPanel` renders from the retained
  `state.capabilities` and the new payload simply replaces it. The test asserting "rows survive the
  click" is the guard.
- **R4 — the raised group cap changes a rendered-row count another test asserts.** Grep for literal
  `40` around capability tests before changing the constant; assert against the export.
- **R5 (WP2) — a fifth way to render the capability mounts.** ADR 0002's standing warning: any new
  render path that is not wired to the same lifecycle anchors renders once and never again. WP2 adds
  *no* new anchors on the canvas (popover-only mount) and re-renders the popover body from the
  existing `modeChanged`/`setBusy`/`backendChanged` handlers, which is precisely why the popover-only
  policy is also the lower-risk one.
- **R6 (WP2) — mode drift between four surfaces.** Structurally prevented: the toggle reads
  `state.currentModeId` and posts `setMode`; it holds no state of its own. The "modeChanged flips the
  switch with no click" test is the executable guard.

## Open questions (answer before the relevant package starts)

**A. ~~Does "extend all the way to the Session Setup panel" also mean equal heights?~~
ANSWERED 2026-07-30 — yes.** The two panels form one flush rectangle: `align-items: stretch`, against
the plan's original recommendation. The implementation consequences (dead space lands inside the
Session Setup card and its content must stay top-pinned; the stacked path is unaffected because
`align-items` is per flex line) are folded into § Thread 1, the R2 risk, and the WP1 checklist.

**B. ~~Where do toggle-shaped actions live?~~ ANSWERED 2026-07-30 — (i) Actions popover only.**
The toggle group renders in the top-bar Actions popover and **not** on the welcome-canvas panel,
where the Session Setup card's Mode row already sits beside it. This is what the plan was written
against, so WP2 needs no restructuring: it is now **un-gated**, the "welcome-canvas panel renders no
`.popover-switch`" test stays in its stated (non-inverted) form as the executable guard for this
decision, and **no ADR 0003 is needed**.

**C. Filesystem watcher for capability roots — now or never?** Recommended: **not now** (manual
refresh ships in WP1). The case *for* doing it: an agent that writes a skill via
`fs/write_text_file` fires no editor save event, so "the agent just created a skill for you" never
shows up without a click. If the user wants it, it is its own follow-up package, not a WP1 scope
creep.

**D. Keep or drop `GROK_BUILTIN_AGENTS`?** Recommended: **keep.** They are real, documented,
per-backend (empty for Claude) capabilities of the running CLI, and "what agents does this thing
have" is exactly the panel's question — even though the rows are inert and the strings are literal.
Dropping them would make the Agents group vanish for most grok users. Flagged because they are, on a
strict reading, the one hardcoded action list in the codebase.

## ADR

**ADR 0002 needs an amendment, not a replacement.** Its Decision paragraph names
`repeat(auto-fit, minmax(min(100%, …), 1fr))` explicitly for `#welcome-grid`, and WP1 changes that
rule. The *policy* it encodes is unchanged and reaffirmed (full canvas by default; intrinsic sizing
only; no `@media`, ever; the left-aligned `95ch` prose measure; locked-not-hidden during priming) —
only the mechanism for one container changes, because `auto-fit`'s equal `1fr` tracks are structurally
incapable of pairing a capped-width card with a fill-remaining panel.

Add a dated **Amendment (2026-07-30)** section to `docs/adr/0002-…md` recording: the gap arithmetic,
that `.welcome-grid` moves to `flex-wrap` while `.capability-group-items` keeps the `auto-fit` grid,
that `align-items: stretch` is the deliberate equal-height choice (decision A) and the Session Setup
card's content stays top-pinned inside the taller box, and that the no-`@media` rule is untouched. A
new ADR is **not** warranted — nothing is superseded, and a second document restating 0002's policy
would split the source of truth.

**No ADR 0003.** That was contingent on answer (ii) to Open question B (a fourth mode surface,
deliberately accepting duplication); the answer was (i), which adds no duplicated control.

---

## Work packages

**Two packages. One implementer dispatch handles exactly one package, end to end — its code, its
tests, and the doc updates it implies. Both are cleared to start (A and B answered); WP2 must still
run *after* WP1, since both touch `media/chat.css`, `media/chat.js`, and
`test/capabilities.dom.test.ts`.**

### WP1 — Close the gap + make the Actions panel refreshable

*Ships regardless of how the Thread 3 fork is answered.*

- [ ] Read `docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md` and CLAUDE.md § Chat
      surfaces (capability-browser bullet) before touching CSS.
- [ ] `media/chat.css`: convert `.welcome-grid` to `display:flex; flex-wrap:wrap; gap:10px;
      align-items:stretch` (decision A — equal heights; keep `width:100%`, `text-align:left`); set
      `.welcome-grid > .session-setup-card { flex: 1 1 min(100%, 300px); max-width: 420px; }` and add
      `.welcome-grid > .capabilities-panel { flex: 1 1 min(100%, 300px); min-width: 0; }`. If the
      `flex` shorthand with `min()` in the basis misbehaves, use the three longhands — do not fall
      back to a bare `300px` basis.
- [ ] Confirm the stretched Session Setup card stays **top-pinned**: it is already a flex column, so
      its default `justify-content: flex-start` suffices — do not add a `justify-content` or a growing
      spacer to fill the new dead space (§ Thread 1, R2).
- [ ] Rewrite the comment block above `.welcome-grid` to state the new invariant and the arithmetic
      reason the old two-`1fr`-track rule gapped (`(W−10)/2 − 420`, opens at ~850px).
- [ ] Confirm no `@media` query was added and `.capability-group-items` is untouched.
- [ ] `media/chat.css`: add `.capabilities-head` + `.capabilities-refresh` (and the popover-head
      variant if the shared `.studio-popover-head` needs `display:flex; justify-content:space-between`).
- [ ] `media/chat.js`: `appendCapabilitiesHeading(container, locked)` builds the head wrapper and,
      when unlocked, the refresh button posting `{type:"listCapabilities"}` (with `stopPropagation`);
      add the same button to `renderCapabilitiesPopover`'s head; pass `locked` through from
      `renderCapabilitiesPanel`.
- [ ] `src/capabilities.ts`: `CAPABILITY_GROUP_CAP` 40 → 100 with a rationale comment; grep the test
      suite for a literal `40` tied to this constant first.
- [ ] Tests: rewrite/add the six `test/chat-layout.dom.test.ts` cases listed in § Test strategy
      (including both decision-A guards — `align-items: stretch` asserted, and the setup card's
      content top-pinned); add
      the four `test/capabilities.dom.test.ts` refresh cases (including the popover-stays-open and
      `showCapabilities:false` guards); update `test/capabilities.test.ts`'s cap case to assert
      against the exported constant.
- [ ] Docs: CLAUDE.md § Chat surfaces (refresh affordance, raised cap) + § Known limits (no watcher;
      no namespaced command subdirs; no cwd→repo-root walk); `docs/architecture.md` § Design choices
      → Capability browser; the dated **Amendment** section in `docs/adr/0002-…md`; a terse
      `CHANGELOG.md` entry.
- [ ] Verify: `npx vitest run test/chat-layout.dom.test.ts test/capabilities.dom.test.ts
      test/capabilities.test.ts && npx tsc -p . --noEmit && npm test`
- [ ] Report back the manual checks the tests structurally cannot make (happy-dom has no layout
      engine): after a local rebuild, a wide tab shows a 10px gutter between the two panels **and the
      two panels end at the same bottom edge**; the Session Setup card's own content still sits at the
      top of its box; and a ~250px split tab has no horizontal scrollbar at 100% and 200%
      `grok.chatFontScale`.

### WP2 — Toggle-shaped actions (auto-accept) — **cleared (B = popover only)**

*Runs after WP1. Mount policy is decided: the toggle group renders in the Actions **popover only**,
never on the welcome canvas — implement exactly as written below. No ADR.*

- [ ] Read § Thread 3 above, `sessionSetupModel` + `pickSessionSetting` (the pattern being mirrored),
      and `setMode`/`displayMode` in `src/sidebar.ts` (the tri-state being represented).
- [ ] `media/webview-helpers.js`: add the pure `sessionToggleGroup({backend, modeId, locked})`
      returning a `{kind:"toggle", title:"Session controls", items, total}` group with one
      auto-accept item (`toggleId`, `label`, `description`, `control:"switch"`, `on`, `locked`);
      export it from the `api` object. No changes to `capabilityGroupsView`.
- [ ] `media/chat.js`: `buildCapabilityRow` gains one branch on `item.control === "switch"` (never on
      `item.kind`), reusing the existing `.popover-switch`/`.popover-switch-knob` markup with
      `role="switch"` + `aria-checked`; no handler at all when `locked`.
- [ ] `media/chat.js`: add `applyCapabilityToggle(toggleId, next)` beside `pickSessionSetting`,
      posting the existing `{type:"setMode", modeId}` per the tri-state table in § Thread 3.
- [ ] `media/chat.js`: `renderCapabilitiesPopoverBody()` prepends the toggle group on **all four**
      paths (`!cap`, `cap.error`, empty `viewGroups`, and the normal path); re-render the open
      popover body from the `modeChanged`, `setBusy`, and `backendChanged` handlers.
- [ ] `media/chat.css`: `.capability-row-toggle` layout only — no new switch visuals.
- [ ] Tests: the pure `sessionToggleGroup` cases in `test/webview-helpers.test.ts` and the DOM cases
      in `test/capabilities.dom.test.ts` listed in § Test strategy, including the four
      empty/error/scanning/no-second-request edge cases and the mount-policy guard.
- [ ] Confirm `test/session-setup.dom.test.ts` and `test/welcome-canvas.dom.test.ts` are green
      **without edits** — if either needed changing, the Mode row or a lifecycle anchor was disturbed.
- [ ] Docs: CLAUDE.md § Chat surfaces (toggle group, mount policy, tri-state mapping);
      `docs/architecture.md` § Design choices → Capability browser; `CHANGELOG.md`.
- [ ] Verify: `npx vitest run test/webview-helpers.test.ts test/capabilities.dom.test.ts
      test/session-setup.dom.test.ts test/welcome-canvas.dom.test.ts && npx tsc -p . --noEmit && npm test`
