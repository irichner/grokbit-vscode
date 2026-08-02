# Survey — Session setup always available at top of tab

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Welcome Session setup card mount | EXISTS | `#session-setup-card` in `src/sidebar.ts:4909`; render `media/chat.js:634–654` |
| Composer quick-settings popover | EXISTS | `#session-settings-popover` in `src/sidebar.ts:4948`; render/open `media/chat.js:661–674` |
| Pure session-setup view-model | EXISTS | `sessionSetupModel` `media/webview-helpers.js:515–560` |
| Shared row DOM builder | EXISTS | `buildSessionSettingsRow` / `buildSessionSettingsRows` `media/chat.js:540–618` |
| Pick → host messages | EXISTS | `pickSessionSetting` `media/chat.js:521–536` (`switchBackend` / `setModel` / `setEffort` / `setMode`) |
| Refresh both mounts | EXISTS | `refreshSessionSettingsMounts` `media/chat.js:678–681` |
| Welcome hide on first send | EXISTS | `clearWelcome` `media/chat.js:2531–2538` calls `hideSessionSetupCard` |
| Welcome card gated on `welcomeVisible` | EXISTS | `renderSessionSetupCard` early-return `media/chat.js:639–642` |
| Composer model chip (mid-session door) | EXISTS | `#model-label` `src/sidebar.ts:4937`; `updateModelLabel` `media/chat.js:413–423`; click opens popover `media/chat.js:6055–6057` |
| Backend chip (composer) | EXISTS | `#backend-label` `src/sidebar.ts:4938`; `updateBackendLabel` `media/chat.js:428+` |
| Mode button (composer) | EXISTS | `#mode-btn` `src/sidebar.ts:4942` |
| Top bar chrome | EXISTS | `.top-bar` header `src/sidebar.ts:4890–4898`; CSS `media/chat.css:81–96` (`justify-content: flex-end`) |
| Plan-mode banner (thin top strip pattern) | EXISTS | `#plan-banner` `src/sidebar.ts:4900–4903`; between top-bar and messages |
| Busy lock for setup controls | EXISTS | `currentSessionSetupModel` keys `locked: state.busy` `media/chat.js:511` |
| Claude omits Thinking | EXISTS | empty `effortLevels` when `state.backend === "claude"` `media/chat.js:503–504` |
| Always-visible top-of-tab session-setup mount after first send | DOES NOT EXIST | searched: `session-setup`, `session-settings`, top-bar session strip; only welcome card + bottom model chip |
| Pure “summary label” builder for chip text | DOES NOT EXIST | model/effort text is inline in `updateModelLabel` (`media/chat.js:413–423`); no shared top-bar summary helper |
| Welcome-card DOM tests | EXISTS | `test/session-setup.dom.test.ts` (incl. disappears on first send at lines 107–112) |
| Model-chip / popover DOM tests | EXISTS | `test/model-chip.dom.test.ts` |
| Pure builder unit tests | EXISTS | `test/webview-helpers.test.ts` (sessionSetupModel coverage; not re-opened fully this pass — file listed by grep) |
| Layout source checks for setup card | EXISTS | `test/chat-layout.dom.test.ts` |
| Webview test harness | EXISTS | `test/webview-harness.ts` |

## Reusable code

Things that already do part of this job. Highest-value section.

- **`sessionSetupModel`** — `media/webview-helpers.js:515–560` — pure Agent/Model/Thinking/Mode rows + locked flag; Claude skips Thinking when `effortLevels` empty.
- **`buildSessionSettingsRows` / `buildSessionSettingsRow` / `pickSessionSetting`** — `media/chat.js:521–618` — one DOM + message path for card and popover; any third mount should call these, not reimplement controls.
- **`openSessionSettingsPopover(anchorBtn)`** — `media/chat.js:667–674` — already takes an anchor button; can open from a top-bar chip without a new popover element.
- **`refreshSessionSettingsMounts`** — `media/chat.js:678–681` — currently card + open popover only; natural extension point to also refresh a top-bar summary label.
- **`updateModelLabel` / `shortEffort`** — `media/chat.js:413–423`, `1143–1149` — short “Model · med” display already exists for the composer chip.
- **Top-bar empty left half** — `.top-bar` is `display:flex; justify-content:flex-end` (`media/chat.css:81–86`); left side is unused for content today (history/new/docs/actions all pack to the end).
- **Popover positioning** — existing `positionPopover` used by session-settings (composer-relative); top-bar anchors may need the same or a top-aligned variant (history/docs popovers use `positionDropdownPopover` for right-edge cases — verify at implement time).
- **`plan-banner` pattern** — full-width strip between top-bar and messages (`src/sidebar.ts:4900–4903`) if a second thin row is chosen; currently only plan mode.
- **DOM test pattern** — `bootWebview` + `dispatch` + `click` in `test/webview-harness.ts`; mirror `test/session-setup.dom.test.ts` / `test/model-chip.dom.test.ts`.

## Supersession

What this change replaces, duplicates, or makes dead. Caller counts are approximate from targeted greps this session.

| Item | Location | Callers | Why superseded / at risk |
|---|---|---|---|
| Mid-session “only” door = `#model-label` in composer | `media/chat.js:6055–6057`, `src/sidebar.ts:4937` | ~10+ refs (updateModelLabel call sites + tests) | Still works, but bottom-only; a top-of-tab door may **duplicate** this affordance |
| `#backend-label` chip | `src/sidebar.ts:4938`, `updateBackendLabel` | composer toolbar | Overlaps Agent row inside session-settings; not the primary pain but third surface for agent |
| Welcome `#session-setup-card` full card | `media/chat.js:634–654` | clearWelcome + render + tests | Must stay for empty tabs unless design unifies; `clearWelcome` currently **destroys** mid-session access via this mount only |
| CSS comment “TWO mounts” | `media/chat.css:1901–1905` | docs + CSS | Will be stale if a third mount (top-bar chip) is added — doc/comment update only |
| CLAUDE.md / README “same four controls mid-session from model chip” | `CLAUDE.md` session-setup bullet; `README.md` Session setup | docs | Release-facing copy may need a line about top-of-tab access |

## Prior attempts

Earlier implementations of this same idea. Say which one live code actually uses.

- **Welcome card only (v1 mental model)** — empty-tab setup; intentionally cleared on first send (`test/session-setup.dom.test.ts:107–112` locks this behavior).
- **Composer model chip → quick-settings popover (WP7)** — live mid-session path today (`media/chat.js:6050–6057`, CHANGELOG Session setup card + quick-settings popover). This is the current mid-session implementation; it is **not** abandoned, but fails the user’s “top of the tab” placement requirement.
- **Gear menu model/effort row** — still exists (`renderGearMain` / `settingsLocked` around `media/chat.js:1949+`); broader settings, not the consolidated four-row Session setup.
- No prior “session setup in top-bar” implementation found.

## Conventions

How this repo actually works, with an example of each.

- **Pure builder + impure mounts** — view-model in `webview-helpers.js`, DOM in `chat.js` (session setup: builder `media/webview-helpers.js:515`, mounts `media/chat.js:634` / `661`).
- **`[hidden]` + forced display gotcha** — `.toolbar-btn` forces `inline-flex`; chips need `#id[hidden] { display:none }` (`media/chat.css:1689`, same for backend/capabilities).
- **Busy lock** — setup controls use `locked: state.busy` (`media/chat.js:511`); tooltip `"Available once the session is ready"` (`media/chat.js:551`).
- **Tests** — vitest + happy-dom driving real `media/chat.js` (`test/session-setup.dom.test.ts:1–8`); suite via `npm test` (project test commands / CLAUDE.md).
- **No `@media` in chat.css** — font scale via `zoom` / `--chat-zoom` (`media/chat.css:32–42`); layout uses flex/`min()`/`auto-fit`.
- **HTML shell in host** — static ids emitted by `GrokSidebar.getHtml` (`src/sidebar.ts:4873+`); new top-bar element likely needs a shell id + JS wiring.
- **Popover close** — document click closes popovers; openers use `stopPropagation` (model chip `media/chat.js:6055–6058`).

## Absences

- No always-on top-of-tab Session setup control after `clearWelcome`.
- No pure helper that formats a one-line “Agent · Model · effort · Mode” summary for a chip (logic is split across `updateModelLabel` / `updateBackendLabel` / mode button).
- No setting flag for showing/hiding session setup (not required by intent).
- Coverage tool: NONE in repo (project test commands) — verify via `npm test` only.

## Danger zones

- **`media/chat.js`** — large single file; many `clearWelcome` call sites; easy to miss a refresh path when adding a third mount.
- **Top-bar width** — history + new + Docs + Grokbit Actions already occupy the right; a long summary chip on the left must ellipsize (same max-width idiom as `.model-label-btn` `media/chat.css:1682–1687`) or collide on narrow split editors.
- **Popover stacking / `position: relative` on `.top-bar`** — `media/chat.css:95`; absolute popovers children of composer today (`src/sidebar.ts:4946–4951` under `<footer class="composer">`). Anchoring a popover from a top-bar button while the popover node lives in the footer may need care (position math is viewport/offset based — confirm in implement; if broken, move popover host or use same pattern as history popover living under top-bar).
- **Duplicate doors** — three UIs for the same four settings (welcome card, top chip, bottom chip) can confuse if labels diverge; refresh must stay single-sourced.
- **Test that asserts card disappears on first send** — `test/session-setup.dom.test.ts:107–112` must remain true for the *welcome card*, while a *new* top control must appear/stay — don’t “fix” by undoing clearWelcome for the whole welcome tree.
