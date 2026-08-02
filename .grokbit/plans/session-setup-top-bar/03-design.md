# Design — Session setup always available at top of tab

## Options considered

### Option A — Top-bar summary chip → existing quick-settings popover (chosen)
**Approach:** Add a single toolbar button on the **left** of `.top-bar` (empty today — survey: `media/chat.css:81–86` flex-end pack). Label is a one-line live summary (e.g. `Grok · Grok Build · med · Agent`), ellipsized. Click opens the **existing** `#session-settings-popover`, reusing `sessionSetupModel` + `buildSessionSettingsRows` + `pickSessionSetting`. Zero extra vertical rows. Welcome `#session-setup-card` remains for empty-tab education.

**Trade-off:** Best on minimal vertical space and reuse. Requires an explicit **dual-anchor popover placement** strategy (see below) because today’s `positionPopover` is composer-bottom-only (`media/chat.js:1863–1877`).

### Option B — Always-on thin session strip under top-bar
**Approach:** New strip between top-bar and messages (plan-banner-like).  
**Trade-off:** Permanently steals message height — worse on minimal-space constraint.

### Option C — Only improve the bottom model chip / docs
**Trade-off:** Fails top-of-tab done-criterion.

## Decision
**Chosen: Option A** with a mandated dual-anchor placement fix (not “verify later”).

What rejected options were better at: **B** zero-click scannability; **C** smallest diff.

## Shape of the change

### 1. Shell (host HTML) — `src/sidebar.ts` `getHtml`

Insert chip as first child of `.top-bar`; push utility buttons right with `margin-left: auto` on `#history-btn` (or a right cluster wrapper). **Do not** only prepend without the spacer rule — flex-end would pack the chip right with the other buttons.

```html
<header class="top-bar">
  <button id="session-setup-chip" class="toolbar-btn session-setup-chip"
          type="button" hidden
          title="Session setup"
          aria-haspopup="dialog"
          aria-expanded="false"></button>
  <!-- history-btn gets margin-left:auto in CSS so the right cluster stays end-packed -->
  <button id="history-btn" …>
  …
  <!-- session-settings-popover stays a single node; default parent may remain composer
       until open re-parents it (see § Dual-anchor placement) -->
</header>
```

Update `test/webview-harness.ts` `BODY` (`test/webview-harness.ts:21–65`) with the same `#session-setup-chip`.

### 2. Dual-anchor popover placement (**BLOCKER fix — mandatory**)

Today:
- Popover lives under `.composer` (`src/sidebar.ts:4948`).
- `openSessionSettingsPopover` → `positionPopover` always places the menu **above** the anchor relative to the **composer** parent (`media/chat.js:1863–1877`, `667–674`).
- Calling that unchanged with a top-bar anchor opens **off-canvas above the header**.

**Required strategy (re-parent-on-open + branch):**

| Anchor | Parent for popover while open | Positioner |
|---|---|---|
| `#session-setup-chip` (inside `.top-bar`) | Append popover to `.top-bar` | **New** `positionSessionSettingsFromTop(popover, btn)`: open **below** the chip; left-align to chip; clamp horizontal so it stays inside the panel (`min`/`max` left like a left-edge-aware variant of `positionDropdownPopover` — **not** the right-align-only `positionDropdownPopover` at `media/chat.js:1879–1897`) |
| `#model-label` (composer) | Append popover to `.composer` (restore default) | Existing `positionPopover` (above button) |

Implementation notes:
- Single DOM node `#session-settings-popover` — re-parent with `appendChild` on each open (moves node; no clone).
- `openSessionSettingsPopover(anchorBtn)` detects ancestor: `topBar.contains(anchorBtn)` vs composer.
- On `closePopovers`, optional: leave node where it is or always park under composer — either is fine if next open re-parents.
- Bottom model-chip path **must keep working** (regression covered by existing `test/model-chip.dom.test.ts`).
- Top path covered by new DOM tests (open → four rows visible, popover not clipped off top — assert `top` style / parent is top-bar).

Do **not** ship a top chip that only calls today’s `positionPopover` unchanged.

### 3. Chip label (pure helper preferred)

Add pure `sessionSetupChipLabel({ backend, modelName, effort, modeId })` in `media/webview-helpers.js` (unit-tested):

| Segment | Source | Short form |
|---|---|---|
| Agent | backend | `Grok` / `Claude` — **mirrors** `updateBackendLabel` (`media/chat.js:428–431`), not full `SETUP_AGENT_OPTIONS` labels |
| Model | model display name | truncated in chat.js when painting (chip max-width), full name in `title` |
| Thinking | effort | `shortEffort` equivalent; **omit segment** when effort empty / Claude |
| Mode | modeId | Map via `SETUP_MODE_OPTIONS` ids: `agent`→`Agent`, `plan`→`Plan`, `yolo`→`Auto` (short for chip density; **full** `Auto accept` in `title` / tooltip so it does not invent a third product name for the mode itself) |

Join with ` · `. Tooltip `title`: `Session setup — {full segments}` (full agent labels + full mode label + full effort word).

### 4. Chip visibility / lock truth table (**frozen**)

| State | Chip visible? | Chip enabled (opens popover)? | Popover rows |
|---|---|---|---|
| Onboarding active (welcome-onboarding non-empty / onboarding not ready) | **hidden** | n/a | n/a |
| No model id yet **and** no usable model list (pre-session) | **hidden** | n/a | n/a |
| Session/model known, `state.busy === true` | **visible** | **yes** (still opens) | **locked** (`locked: state.busy` existing) |
| Session/model known, ready | **visible** | **yes** | unlocked |
| After first send (`welcomeVisible === false`) | **visible** if model known | per busy | per busy |
| Empty welcome still showing card | **visible** if model known (redundant door OK) | per busy | per busy |

Rationale: lock lives on **rows** (existing pattern), not by disabling the chip — user can still inspect settings while a turn runs. Onboarding hides the chip so it doesn’t compete with auth/missing-CLI cards.

A11y minimum:
- Native `<button type="button">`
- `aria-haspopup="dialog"` (or `"menu"`)
- `aria-expanded="true|false"` toggled in open/close
- Existing `.toolbar-btn:focus-visible` treatment; no new custom focus ring required
- `title` always carries full non-truncated summary when visible

### 5. Webview wiring (`media/chat.js`)

- `updateSessionSetupChip()` paints label via pure helper + truncation; applies truth table.
- `sessionSetupChip.onclick` → `openSessionSettingsPopover(sessionSetupChip)` (with dual-anchor logic inside open).
- Call `updateSessionSetupChip` from the same host events as `updateModelLabel` / `refreshSessionSettingsMounts` (session, modelChanged, modeChanged, backendChanged, setBusy, initialState effort).
- **Optimistic effort path:** `pickSessionSetting` already calls `updateModelLabel` then `refreshSessionSettingsMounts` (`media/chat.js:531–535`) — extend `refreshSessionSettingsMounts` to call `updateSessionSetupChip`, **or** call it beside `updateModelLabel` on the effort branch so top chip updates in the same tick.
- Do **not** change `clearWelcome` / welcome-card hide (`media/chat.js:2531–2538`).

### 6. CSS (`media/chat.css`)

- `.session-setup-chip` — muted like `.model-label-btn`; `max-width` ~ min(50%, 28ch); ellipsis; `[hidden]{display:none}` (toolbar-btn display override).
- `#history-btn { margin-left: auto; }` (or `.top-bar-right` cluster) so chip stays left.
- Update “TWO mounts” comment → three surfaces: welcome card, composer popover, top-bar chip.
- No `@media`.

### 7. Composer model chip
**COEXIST** — keep `#model-label` opening the same popover (dual-anchor table). No removal in this plan.

### 8. Welcome card
**LEAVE** — empty-tab education + free-to-change footer.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Bottom `#model-label` door | COEXIST | Muscle memory + existing tests; top meets discoverability | Dual-anchor open must keep bottom path green; both refresh chip/label |
| `#backend-label` + `#mode-btn` | LEAVE | Out of scope | — |
| Welcome `#session-setup-card` | LEAVE | Empty-tab UX | Hide-on-first-send test stays green |
| CSS “TWO mounts” comment | REPLACE (comment) | Third mount | Update when chip lands |
| CLAUDE.md / README mid-session line | REPLACE (docs) | Mention top-bar Session setup chip | Short doc line at implement/rebuild |
| `positionPopover` alone for top anchor | REPLACE (behavior) | Geometrically wrong for top anchor | Dual-anchor branch; top uses new below-chip positioner |

## Named DOM / unit tests (required)

New file preferred: `test/session-setup-chip.dom.test.ts` (+ pure tests in `test/webview-helpers.test.ts` if helper added).

| # | Case | Asserts |
|---|---|---|
| 1 | After first send, chip visible; welcome card still hidden | `userMessage` → card hidden (existing contract); chip `hidden===false` |
| 2 | Click chip opens session-settings popover with four rows (Grok) | labels Agent/Model/Thinking/Mode; gear still closed |
| 3 | Popover parent is top-bar (or position uses below-chip branch) after top open | dual-anchor |
| 4 | Bottom model-label still opens popover (regression) | existing model-chip tests green; optional assert re-parent back to composer |
| 5 | `setBusy:true` → rows locked inside popover; chip still visible | |
| 6 | Claude: chip label omits effort; popover omits Thinking | |
| 7 | Onboarding active → chip hidden | |
| 8 | Pure `sessionSetupChipLabel` unit cases | agent/mode/effort omit rules |

Existing: `test/session-setup.dom.test.ts`, `test/model-chip.dom.test.ts` stay green.

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Busy / priming | Chip visible (if model known); rows locked |
| No model yet | Chip hidden |
| Onboarding | Chip hidden |
| Narrow panel | Ellipsis + full `title` |
| Plan banner on | Independent; chip above banner in top-bar |
| Concurrent history popover | `closePopovers()` first |
| Re-parent race | Single popover node; one open at a time |

## Migration
Schema: no · Reversible: yes · Deps: none
