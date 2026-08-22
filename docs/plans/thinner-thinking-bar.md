# Plan: Thinner thinking bar

**Slug:** `thinner-thinking-bar`  
**Grokbit artifacts:** `.grokbit/plans/thinner-thinking-bar/`  
**Depends on:** shipped `#thinking-bar` (`docs/plans/thinking-color-bar.md`). This change is CSS thickness only.

## Goal

While a session is thinking, the full-width neon strip under the chat top bar (`#thinking-bar`) should be **thinner** than the shipped **4px** band. Keep the same slot, animation, tokens, and show/hide policy.

### Acceptance criteria (falsifiable)

1. `.thinking-bar {` in `media/chat.css` declares `height: 2px` and does **not** declare `height: 4px` (machine check for thickness).
2. Lead UI verify (`NO UI TOOLING`; happy-dom has no layout engine): at **100%** chat zoom on an unlocked busy turn the strip is a **2px** band (half of the shipped 4px). At **60%** `--chat-zoom` (`media/chat.css:40`) it remains visible (~1.2px). This is not a license to ship 1px.
3. Motion unchanged: `ruleBlock` still contains `animation:`, `0.6s`, `--neon-cyan-ink`, `--neon-magenta-ink`, `--neon-green-ink`; no `hue-rotate`; `@keyframes thinking-bar-shift` still animates `background-position`.
4. `.thinking-bar[hidden] { display: none }` remains.
5. Reduced-motion still folds into the existing grokking `@media (prefers-reduced-motion: reduce)` (`.thinking-bar { animation: none; }`). `chat.css` `@media` count stays **2**.
6. Visibility unchanged: priming / locked / historyReplay / panelReplaying / live unresolved permission|question|plan cards hide the bar; unlocked busy shows it; restored `.plan-history` does **not** hide it; bar and `#plan-banner` can both show. Proven by existing `test/thinking-bar.dom.test.ts` (JS not edited).
7. `.mic-waves i {` still declares `height: 4px` and `@keyframes mic-bar` still uses `4px` at rest — proven by `ruleBlock` / keyframe source-check in `test/chat-layout.dom.test.ts`, not by scoping the thinking-bar `ruleBlock`.
8. Markup, `aria-hidden="true"`, and `updateThinkingBar()` are untouched.
9. `npx vitest run test/chat-layout.dom.test.ts test/thinking-bar.dom.test.ts`, `npx tsc -p . --noEmit`, and `npm test` are green.

## Non-goals

- Changing when the bar shows or hides (JS, host messages, card selectors).
- Changing animation duration, gradient tokens, or reduced-motion policy.
- Restyling the activity carousel `.activity-strip`, Grokking / Thinking… stand-in, status-bar HUD, or plan-mode banner.
- New settings, CSS custom properties, host protocol, or markup.
- Playwright / screenshot visual regression (repo has none).
- Rewriting the historical 4px spec in `docs/plans/thinking-color-bar.md`.

## Risk / blast radius

| Surface | Change |
|---|---|
| `media/chat.css` `.thinking-bar {` | `height: 4px` → `height: 2px` only |
| `test/chat-layout.dom.test.ts` | Pin `height: 2px` / not `height: 4px` on `.thinking-bar {`; pin `.mic-waves i {` `height: 4px` and `mic-bar` rest `4px` |
| `media/chat.js`, `src/sidebar.ts`, harness, visibility tests | **none** |

User impact: every live thinking tab shows a thinner strip; idle/hidden tabs unchanged. No data, auth, or protocol. Wrong-scope replace of every `height: 4px` would shrink the mic equalizer — implementation must edit only `.thinking-bar {`.

Shared-lib: none. Rollback: restore `4px` and drop the new height / mic expects.

## Approach (chosen)

**A — Literal `height: 2px` on the existing rule (chosen).** Half of the shipped 4px. No new token. JS/markup/a11y unchanged.

**B (rejected):** `--thinking-bar-height` custom property — unused abstraction; no setting.

**C (rejected):** `1px` or `border-bottom` — can subpixel-vanish at 60% `grok.chatFontScale` (`body` `zoom`); box-model change.

Gate override: 1px or 3px is still A with a different literal + test pin.

### Disposition

| Item | Disposition | Reason |
|---|---|---|
| `.thinking-bar` `height: 4px` | REPLACE | T1 |
| Historical 4px in `docs/plans/thinking-color-bar.md` | LEAVE | archive |
| `.mic-waves i` `height: 4px` | LEAVE | unrelated equalizer; T1 pins it so a global replace fails |
| `.activity-strip` | LEAVE | different surface |
| `updateThinkingBar` / markup / `aria-hidden` | LEAVE | out of scope |

## Ordered steps

### T1 — Thin the thinking bar to 2px and pin it

**Files:** `media/chat.css`, `test/chat-layout.dom.test.ts`

1. In `.thinking-bar {` (`media/chat.css` ~3098-3110) set `height: 2px`. Do not global-replace `4px`.
2. In `describe("thinking-bar motion (source check)")`: after `ruleBlock(css, ".thinking-bar {")`, assert `height: 2px` and not `height: 4px`. Also `ruleBlock(css, ".mic-waves i {")` contains `height: 4px`, and `@keyframes mic-bar` still has `height: 4px` at rest. Keep all existing motion / `[hidden]` / `@media` assertions.

**Verify (PowerShell):** `npx vitest run test/chat-layout.dom.test.ts test/thinking-bar.dom.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc -p . --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test`

**Baseline:** 4px bar; motion tests do not mention height; visibility suite green; mic equalizer 4px has no pin today.

**Rollback:** `height: 4px` + remove the new height / mic expects.

**state-after:** working

## Testing strategy

| Behavior | Test | Edge/negative |
|---|---|---|
| Thickness 2px | `ruleBlock(".thinking-bar {")` contains `height: 2px` | `height: 4px` on `.thinking-bar` fails |
| Mic equalizer left at 4px | `ruleBlock(".mic-waves i {")` contains `height: 4px`; `mic-bar` rest `4px` | global `4px`→`2px` replace fails (this is AC7; scoped thinking-bar `ruleBlock` is not this negative) |
| Motion unchanged | existing animation / 0.6s / ink / no hue-rotate | |
| Hidden via `[hidden]` | existing `[hidden] { display: none }` | |
| Reduced motion | grokking `@media` contains `.thinking-bar { animation: none }`; count 2 | third `@media` fails |
| Visibility unchanged | full `test/thinking-bar.dom.test.ts` (JS untouched) | plan-history negative already in that file |

Coverage: `media/` CSS **UNMEASURED / no changed executable lines**. `npm run test:coverage` is real for JS; this diff is CSS + test. Do not record fake 100%. Waiver not required for vacuous CSS delta.

## Failure modes

- **Global 4px replace:** mic equalizer shrinks — scoped CSS edit **and** a `ruleBlock` pin on `.mic-waves i {` / `mic-bar` so CI goes red.
- **Drop `[hidden]` override:** bar stays in layout while “hidden” — existing test.
- **New `@media` for thickness:** fails count=2; violates no-viewport-breakpoint policy (`zoom` on `body`).
- **JS visibility tweak:** out of scope; would re-open thinking-color-bar AC 2–8.
- **1px at 60% zoom:** if gate overrides to 1px, bar may vanish — stay at 2px unless human says otherwise.
- **Rollback:** revert the two files.

## Observable verification

- Machine: `.thinking-bar {` `height: 2px` not `4px`; `.mic-waves i {` still `height: 4px`; existing motion + visibility tests; `tsc`; `npm test`.
- Manual (`NO UI TOOLING`): at 100% zoom send a prompt — strip is a **2px** band under the top bar, still cycling; at 60% chat zoom the band remains visible; with OS reduced-motion, **2px static** gradient; plan-mode tab can show the 2px bar above the plan banner.

## UI/UX design

**Reference:** shipped `#thinking-bar` pattern (`docs/plans/thinking-color-bar.md`) — full-width sibling under `.top-bar`, ink neon gradient, 0.6s `background-position`. This plan changes **height only** (4px → 2px). Tokens stay `--neon-*-ink` (not raw `--neon-cyan`). No new ad-hoc color. `:root` has `--pad` / `--gap` / `--radius` only — **no bar-height token**, so a literal `2px` is not a design-system blocker (UI standards forbid hardcoded values *where a token exists*). 2px also matches the sibling `.plan-banner { border-bottom: 2px }` (`media/chat.css:3128`) — local rhythm, not a second source of truth.

**State inventory** (bar is decorative, not a control — `aria-hidden="true"`; Grokking already names working state):

| State | Expected |
|---|---|
| empty / idle | hidden (`[hidden]`) — N/A thickness |
| priming (`busyLocked`) | hidden |
| loading / thinking (unlocked busy, no unresolved card) | visible, **2px**, 0.6s ink-gradient slide |
| needs-you (live unresolved permission/question/plan card) | hidden |
| panel rebuild / history replay | hidden |
| `prefers-reduced-motion` | visible **2px** static gradient (`animation: none`) |
| error / `agentEnd` | hidden |
| hover / focus / disabled | **N/A** — not interactive; no keyboard target |
| overflow / narrow split tab | full width of the column (unchanged); `flex-shrink: 0`; no `@media` |
| zoom 60%–300% | 2px declared scales with `body` zoom; still thinner than old 4px at the same zoom |

**A11y:** Keep `aria-hidden="true"`. Do not add `aria-live` (would double-announce with Grokking). Contrast of ink tokens unchanged (decorative strip, not text). No new focus ring required (not a control).

**Design acceptance (falsifiable, not “looks good”):**

- Source-text: `.thinking-bar {` has `height: 2px`, not `4px`.
- Source-text: `.mic-waves i {` still has `height: 4px`; `mic-bar` rest still `4px`.
- Source-text: animation/tokens/`[hidden]`/reduced-motion assertions still pass.
- Manual: at 100% zoom the live strip is a **2px** band; at 60% zoom it remains visible; reduced-motion still shows a 2px static gradient.

## Assumptions

- Surface is `#thinking-bar`, not `.activity-strip` or `.mic-waves`.
- Target height **2px** unless the user says 1px or 3px at approval.
- Visual thinness beyond source-text is Lead UI verify (`NO UI TOOLING`).

## Approval

- [x] Human approved — 2026-08-22 (user: “approve”; 2px confirmed by proceeding with plan default)
