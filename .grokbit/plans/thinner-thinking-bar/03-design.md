# Design — Thinner thinking bar

## Options considered

### Option A — Change only `height` on the existing `.thinking-bar` rule (2px)

Approach: In `media/chat.css` `.thinking-bar {` (`02-survey.md` → `media/chat.css:3098-3110`), replace `height: 4px` with `height: 2px`. Leave gradient, `background-size`, animation, `[hidden]`, reduced-motion, markup, and JS untouched. Pin the new value in the existing `ruleBlock` source-check (`test/chat-layout.dom.test.ts:179-192`).

Trade-off (against intent constraints): Smallest blast radius (one declaration + one test assertion). Thickness is still a literal px, matching how the bar was shipped (`02-survey.md` — height token DOES NOT EXIST). 2px remains visible at 100% zoom; at 60% chat zoom it renders ~1.2px (accepted in `01-intent.md` Constraints). Does not make height user-tunable.

### Option B — Introduce `--thinking-bar-height` and set it to 2px

Approach: Add a custom property (on `:root` or `.thinking-bar`) and `height: var(--thinking-bar-height, 2px)`. Tests would pin the variable and the rule.

Trade-off: Extra abstraction for a value that is not themed, not settings-backed, and not reused (`02-survey.md` — one declaration, no token). Violates “no new CSS custom properties” in `01-intent.md` Non-goals unless we invent a settings story. Better only if height will be tweaked again soon.

### Option C — 1px hairline (or `border-bottom: 1px` instead of height)

Approach: `height: 1px` or convert the strip to a border so some engines round to a device pixel.

Trade-off: Thinner still, but at 60% zoom (`grok.chatFontScale` floor, `src/sidebar.ts:5721`) a 1px bar can subpixel-vanish. A border-based bar changes the box model vs the current height+flex-shrink strip and is a larger visual redesign than requested. 3px would be only marginally thinner than 4px.

## Decision

**Chosen: A** — `height: 2px` on the existing rule.

Rationale against constraints: Intent is “thinner,” not “tunable” or “redesign.” Survey shows a single literal `height: 4px` with no token and tests that do not pin height — so replacing that one line plus extending the existing source-check is sufficient and does not touch JS visibility (`media/chat.js:428-438`). 2px is half the shipped thickness, still a continuous color strip at default zoom, and still scales with `--chat-zoom`.

What the rejected options were better at: **B** is better if product later wants a setting or theme token. **C** is better if the user wanted the thinnest possible line on 1x displays (and accepted zoom disappearance). Gate can still override 2px → 1px or 3px; that stays Option A with a different literal.

## Shape of the change

- **CSS:** `media/chat.css:3099` `height: 4px` → `height: 2px` inside `.thinking-bar {` only. Comment at `:3095-3097` can stay (slot description); no comment required for the new px.
- **Tests:** In `test/chat-layout.dom.test.ts` thinking-bar motion case (`:182-192`), after `const rule = ruleBlock(css, ".thinking-bar {");`, assert `rule` contains `height: 2px` and does not match `height: 4px`. Also `ruleBlock(css, ".mic-waves i {")` contains `height: 4px`, and `@keyframes mic-bar` still has `height: 4px` at rest — this is the mic done-criterion, not the scoped thinking-bar `ruleBlock` (that only prevents a false fail). Keep animation / token / `[hidden]` / reduced-motion / `@media` count assertions. Do **not** change `test/thinking-bar.dom.test.ts` (visibility; JS untouched).
- **Out of the edit:** `updateThinkingBar` (`media/chat.js:428-438`), markup (`src/sidebar.ts:5734`), harness (`test/webview-harness.ts:32`), `.mic-waves i` (`media/chat.css:1670-1682`), `.activity-strip` (`media/chat.css:1172-1182`).

## Disposition of superseded code

Every item from the survey's supersession section.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| `.thinking-bar` `height: 4px` (`media/chat.css:3099`) | REPLACE | New thickness is 2px on the same rule; one declaration, no other live writers | After the replacement verifies, that line must read `height: 2px` and must not still say `4px` |
| Historical “4px full-width strip” in `docs/plans/thinking-color-bar.md` | LEAVE | Archive of the original feature; rewriting old plans is out of scope (`01-intent.md` Non-goals). Live CSS is the source of truth | — |
| `.mic-waves i` `height: 4px` (`media/chat.css:1672`, `:1681`) | LEAVE | Unrelated equalizer; survey danger zone | Do not global-replace 4px; T1 **pins** `.mic-waves i {` `height: 4px` so a stray replace fails CI |
| `.activity-strip` padding / row chrome | LEAVE | Different surface (text+icon row, not the cycling bar) | — |
| `updateThinkingBar` / markup / `aria-hidden` | LEAVE | Visibility and a11y unchanged | — |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Bar hidden (idle, priming, replay, needs-you) | `[hidden]` → `display: none`; thickness irrelevant (unchanged) |
| Unlocked busy | 2px animated gradient strip; same show formula |
| `prefers-reduced-motion: reduce` | 2px **static** ink gradient (`animation: none` already in grokking `@media`) |
| Chat zoom 60% / 300% | Declared 2px scales with `body` zoom (~1.2px / ~6px). Still thinner than the old 4px at the same zoom |
| Plan banner also visible | Bar remains the sibling **above** `#plan-banner`; stacking unchanged |
| Partial CSS edit / `[hidden]` dropped | Existing tests fail (`test/chat-layout.dom.test.ts:190`, visibility suite) |
| Accidental mic-waves edit | Mic listening equalizer shrinks; T1 pins `.mic-waves i {` `height: 4px` so CI fails |

## Migration

Schema change: no  
Reversible: yes (`height: 2px` → `height: 4px`)  
Existing rows: n/a (no data)  
Mixed-version window: n/a (extension vsix ships one CSS)

## New dependencies

None.
