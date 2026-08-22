# Survey — Thinner thinking bar

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| `#thinking-bar` markup (getHtml) | EXISTS | `src/sidebar.ts:5734` — `<div id="thinking-bar" class="thinking-bar" hidden aria-hidden="true"></div>` immediately after `</header>` (`:5732`) and before `#plan-banner` (`:5735`). Opening `<header>` is `:5723`. |
| Harness mirror of that node | EXISTS | `test/webview-harness.ts:32` — same `id="thinking-bar"` so `$("thinking-bar")` is not null in DOM tests |
| `.thinking-bar` visual rule | EXISTS | `media/chat.css:3098-3110` — `height: 4px;` at `:3099`, `flex-shrink: 0`, ink-token 90deg gradient, `background-size: 300% 100%`, `animation: thinking-bar-shift 0.6s linear infinite` |
| `[hidden]` override | EXISTS | `media/chat.css:3111` — `.thinking-bar[hidden] { display: none; }` |
| Keyframes | EXISTS | `media/chat.css:3112-3114` — `@keyframes thinking-bar-shift { to { background-position: 200% 0; } }` |
| Reduced-motion freeze | EXISTS | `media/chat.css:813-816` — inside grokking `@media (prefers-reduced-motion: reduce)`: `.thinking-bar { animation: none; }` |
| Visibility policy (JS) | EXISTS | `media/chat.js:428-438` — `updateThinkingBar()`: `show = busy && !busyLocked && !replaying && !panelReplaying && !hasUnresolvedInteractiveCard()`; `thinkingBar.hidden = !show` |
| Interactive-card selector | EXISTS | `media/chat.js:422-426` — `.card.permission:not(.resolved), .card.question:not(.resolved), .card.plan:not(.plan-history):not(.resolved)` |
| Startup query | EXISTS | `media/chat.js:36` — `const thinkingBar = $("thinking-bar");` |
| Visibility DOM tests | EXISTS | `test/thinking-bar.dom.test.ts` — markup slot (`:15-31`), priming/busy/lock/replay/panel-replay/permission/plan-history/plan-banner coexistence (`:34-147`). **No height assertion.** |
| Motion source-check | EXISTS | `test/chat-layout.dom.test.ts:179-199` — `ruleBlock(css, ".thinking-bar {")` asserts animation, `0.6s`, three `--neon-*-ink` tokens, no `hue-rotate`, `[hidden]` `display: none`, keyframes `background-position`; grokking `@media` contains `.thinking-bar { animation: none; }`; `@media` count is **2**. **Does not assert `height`.** |
| `ruleBlock` helper | EXISTS | `test/chat-layout.dom.test.ts:18-25` — slices one top-level rule from a line-start selector |
| Activity carousel strip | EXISTS | `media/chat.css:1172-1182` — `.activity-strip` is a **text+icon row** (`padding: 3px 0`), not the cycling color bar |
| Mic equalizer 4px bars | EXISTS | `media/chat.css:1670-1682` — `.mic-waves i { height: 4px; }` and `@keyframes mic-bar` 4px↔14px. **Unrelated.** Must not be rewritten by a global “4px → 2px” replace. |
| Chat zoom | EXISTS | `src/sidebar.ts:5721` sets `--chat-zoom` on `<body>`; `media/chat.css:40` applies `zoom: var(--chat-zoom, 1)` (this is what scales the bar’s px). `chatFontScale()` clamp is 60–300. |
| Height design token | DOES NOT EXIST | searched `chat.css` for `--thinking-bar` / spacing scale for bar height; thickness is a literal `4px` on the rule |
| Playwright / screenshot UI tooling | DOES NOT EXIST | `test/chat-layout.dom.test.ts:1-7` states happy-dom has no layout engine; prior thinking-bar plan recorded `NO UI TOOLING` for keyframes |

## Reusable code

- **`ruleBlock` + thinking-bar motion describe** — `test/chat-layout.dom.test.ts:18-25` and `:179-192`. Extend the existing `.thinking-bar {` source-check with `height: 2px` / not `height: 4px`, **and** add `ruleBlock(css, ".mic-waves i {")` contains `height: 4px` (plus `@keyframes mic-bar` rest `4px`) so a global 4px→2px replace fails. Do not invent a new test file.
- **`test/thinking-bar.dom.test.ts`** — keep as the visibility suite; thickness is CSS, not JS. No new visibility cases required if JS is untouched.
- **Existing `.thinking-bar` rule** — `media/chat.css:3098-3110`. Change only `height: 4px` → `height: 2px`. Do not restyle gradient, animation, or `[hidden]`.

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| `.thinking-bar` `height: 4px` | `media/chat.css:3099` | 1 declaration (the rule itself). Tests do **not** pin 4px today (`test/chat-layout.dom.test.ts:182-192` omits height). | Intent is a thinner strip; the 4px value is the shipped thickness to replace. |
| Historical plan spec “4px full-width strip” | `docs/plans/thinking-color-bar.md:54` and `:106` | Documentation of the original feature; not executed. | New thickness supersedes the **live CSS value**, not the archive of how the bar was first specified. |

Caller search for `thinking-bar` (this session): `media/chat.js` (query + `updateThinkingBar`), `media/chat.css` (visual + reduced-motion), `src/sidebar.ts` (markup), `test/webview-harness.ts`, `test/thinking-bar.dom.test.ts`, `test/chat-layout.dom.test.ts`, plus plan/waiver docs. No other live height writers.

## Prior attempts

- **Shipped thinking color bar** — `docs/plans/thinking-color-bar.md` chose a dedicated `#thinking-bar` sibling, **4px**, 0.6s `background-position`, ink tokens. Live code matches that plan (`media/chat.css:3098-3110`, `src/sidebar.ts:5734`). This request is a follow-up thickness tweak on that same element, not a second bar.
- **Waiver** — `docs/waivers/thinking-color-bar-plan-pass-2.md` covered a plan-history selector gap. Expiry was the plan-history negative in `test/thinking-bar.dom.test.ts:126-137`, which now exists. Not a competing implementation.

## Conventions

- **CSS tests:** source-text on `media/chat.css` via `ruleBlock`, because happy-dom has no layout engine — `test/chat-layout.dom.test.ts:1-7`, `:18-25`, `:179-199`.
- **Visibility tests:** drive real `media/chat.js` through `bootWebview` / `dispatch` — `test/thinking-bar.dom.test.ts:7`, `:34-56`.
- **Decorative a11y:** bar is `aria-hidden="true"` because Grokking already exposes working state — `src/sidebar.ts:5734`; original plan `docs/plans/thinking-color-bar.md:82`.
- **No extra `@media`:** reduced-motion is folded into the grokking block so count stays 2 — `media/chat.css:813-816`, asserted `test/chat-layout.dom.test.ts:194-198`.
- **`[hidden]` vs display:** explicit `.thinking-bar[hidden] { display: none }` — `media/chat.css:3111` (same class of bug as `#model-label[hidden]`).
- **Verify commands:** vitest + `npx tsc -p . --noEmit` + `npm test` (Windows). Coverage command exists (`npm run test:coverage`) but `media/` CSS is not executable JS; prior thinking-bar plan recorded **UNMEASURED / no changed executable lines**.

## Absences

- No computed-style / pixel-height assertion in happy-dom.
- No Playwright, Storybook, or screenshot slot for this strip (`NO UI TOOLING` for visual thickness beyond source-text).
- No CSS variable for thinking-bar height.

## Danger zones

- **`media/chat.css`** — large shared stylesheet. A naive replace of every `height: 4px` would also hit `.mic-waves i` (`:1672`) and `@keyframes mic-bar` (`:1681`). Scope the edit to the `.thinking-bar {` rule only (`:3098-3110`).
- **`media/chat.js` `updateThinkingBar`** — many call sites (`:3682` and later). Out of scope; do not retouch visibility.
- **`@media` count of 2** — adding a breakpoint for thickness would fail `test/chat-layout.dom.test.ts:195` and violate the no-`@media` canvas policy.
