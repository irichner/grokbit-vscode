# Review log — Thinner thinking bar

Append-only. Never overwrite a previous round.

## Round 1

Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

Spot-check (opened this session): `media/chat.css` `.thinking-bar` (`:3098-3114`), grokking reduced-motion (`:813-816`), `.mic-waves i` (`:1670-1682`), `.activity-strip` (`:1172-1182`), `body` zoom (`:32-42`); `test/chat-layout.dom.test.ts` (`:18-25`, `:179-199`); `test/thinking-bar.dom.test.ts`; `media/chat.js` `updateThinkingBar` (`:428-438`); `src/sidebar.ts` `#thinking-bar` (`:5721-5735`); `test/webview-harness.ts:32`; `docs/plans/thinking-color-bar.md:54,106`. `@media` count in `chat.css` is 2 (`:813`, `:1204`). `test/` contains **zero** `height: 4px` pins.

### Grounding

Citations for the live bar, motion test, visibility suite, mic equalizer, and JS policy are real and say what the survey claims. Two nits:

- [MINOR] Survey marks `</header>` as `src/sidebar.ts:5723` — evidence (`src/sidebar.ts:5723` is the **opening** `<header class="top-bar">`; `</header>` is `:5732`; the bar is `:5734`) — what would resolve it: fix the parenthetical to `:5732`. Slot claim (under header, above `#plan-banner` `:5735`) is still true.
- [MINOR] Zoom-scales-px is true but under-cited — evidence (`media/chat.css:40` is `zoom: var(--chat-zoom, 1)`; `src/sidebar.ts:5721` only sets the variable; `chatFontScale()` `:4324-4327` returns `0.60–3.00`) — what would resolve it: cite `chat.css:40` next to the inline var. Constraint math (~1.2px at 60% zoom) still holds.

No uncited codebase claims in `03-design.md` beyond those inherited from the survey.

### Intent drift

Option A maps to every done-criterion: 2px on the existing rule, motion/tokens/`[hidden]`/reduced-motion/`@media` count left alone, JS visibility untouched, no new settings/tokens/markup. Non-goals honored (B rejected for a custom property; C rejected for 1px/border). No restyle of `.activity-strip` / Grokking / HUD / plan banner.

### Reinvention

None. Extends `ruleBlock` + the existing `.thinking-bar {` source-check (`test/chat-layout.dom.test.ts:18-25`, `:179-192`). Does not add a height token (DOES NOT EXIST) or a second bar.

### Undeclared supersession

Survey supersession has two items; both are disposed in `03-design.md`:

| Survey item | Disposition |
|---|---|
| `.thinking-bar` `height: 4px` (`media/chat.css:3099`) | REPLACE |
| Historical 4px spec in `docs/plans/thinking-color-bar.md` | LEAVE |

Extra LEAVE rows (mic-waves, `.activity-strip`, JS/markup/`aria-hidden`) were danger-zone / out-of-scope entities, not undeclared duplicates. No `COEXIST`. No second thickness mechanism.

### Decommission

REPLACE has one live writer (the declaration itself). Tests do not pin 4px today (`test/chat-layout.dom.test.ts:182-192`). T1 in-place swap accounts for that caller.

### Unhappy paths / blast radius / migration

Hidden / unlocked-busy / reduced-motion / zoom / plan-banner stacking / dropped `[hidden]` are covered. Accidental mic-waves edit is named. Schema n/a; rollback is the 4px restore. `media/chat.css` danger zone (naive `height: 4px` replace hits `:1672` and `:1681`) is the real blast radius and is scoped to `.thinking-bar {` only.

- [MINOR] Mic-untouched is an intent done-criterion but is not a falsifiable design check — evidence (`01-intent.md` “Unrelated 4px rules… untouched”; `test/` has no `height: 4px` and `test/voice-ui.dom.test.ts:31` only asserts `mic-waves` markup; a global `height: 4px` → `height: 2px` still passes every current test) — what would resolve it: pin `ruleBlock(css, ".mic-waves i {")` still contains `height: 4px` (and optionally `@keyframes mic-bar`). Notes-only is not a check.

### Verifiability of done-criteria (design)

| Criterion | Design proof | Gap? |
|---|---|---|
| Visually thinner than 4px | 2px + Lead UI verify (`NO UI TOOLING`) | no (tooling absent is surveyed) |
| Rule is `height: 2px`, not `4px` | extend existing `ruleBlock` | no |
| Motion / ink / 0.6s / no hue-rotate | keep existing asserts | no |
| Visibility unchanged | do not touch JS; keep `thinking-bar.dom.test.ts` | no |
| `[hidden]` + reduced-motion + `@media`=2 | keep existing asserts | no |
| Mic 4px untouched | T1 notes + scoped `ruleBlock` | yes — MINOR above |
| Targeted vitest + tsc + npm test | named commands | no |

Chosen approach A is the right shape. No BLOCKER, no MAJOR.

## Plan review (Loop 4)

Reviewed: `plan.md`

### Task verify vs intent

T1 intent: half-height 2px, motion/tokens/visibility unchanged, restore of 4px fails CI.

- Height + restore-fails-CI: new `rule` contains `height: 2px` / does not contain `height: 4px` (on the **rule**, not the whole file — notes correctly warn that a file-wide negative would collide with mic-waves).
- Motion/tokens: existing `chat-layout` asserts kept.
- Visibility: `test/thinking-bar.dom.test.ts` in `verify:` even though T1 does not edit it — correct regression.

`baseline:`, `removes: none` (in-place token swap, not a deletion), and rollback are present. Coverage note **UNMEASURED / no changed executable lines** is the right ladder rung for CSS.

- [MINOR] T1 `verify:` is not copy-pasteable in Windows PowerShell as written — evidence (`plan.md:12` uses `` `…` ; then `npx tsc …` ; then `npm test` ``; PowerShell has no `then` keyword — `then: The term 'then' is not recognized`) — what would resolve it: three commands separated by `;` only, or listed as separate lines. The commands themselves (`npx vitest run …`, `npx tsc -p . --noEmit`, `npm test`) are Windows-runnable.

### Verification matrix vs `01-intent.md`

Every done-criterion appears in the matrix. Mapping is honest except:

- [MINOR] Matrix row “Mic equalizer 4px untouched | T1 notes + `ruleBlock` scoped to `.thinking-bar {`” does **not** prove the criterion — evidence (`plan.md:27`; T1 notes at `:17` even say “`.mic-waves i` `height: 4px` must **not** fail because `ruleBlock` is scoped” — that prevents a false fail, it does not detect a mic edit; `npm test` would still be green after a 3-site `height: 4px` replace) — what would resolve it: add the `.mic-waves i` (and optionally `mic-bar` keyframes) source-check to T1 and point the matrix at that assert. Same finding as Round 1; this is the translation gap.

Lead UI verify lives in T1 notes, not in `verify:` — acceptable under `NO UI TOOLING`.

### Disposition summary vs `03-design.md`

| `03-design.md` | `plan.md` summary |
|---|---|
| REPLACE ×1 (`.thinking-bar` 4px) | REPLACE 1 — T1 |
| LEAVE ×4 (historical plan, mic-waves, activity-strip, JS/markup/a11y) | LEAVE 4 — same four |
| DEPRECATE 0 / COEXIST 0 | match |

None dropped.

### Open assumptions

Pointer to `assumptions.md` matches intake (surface, 2px, `NO UI TOOLING`). Gate override 1px/3px still Option A.

## Outcome

Rounds used: 1 of 3
Outstanding at exit: none blocking (0 BLOCKER, 0 MAJOR). Residual MINORs: (1) pin `.mic-waves i` `height: 4px` so the mic done-criterion is machine-checkable; (2) drop `then` from T1 `verify:`; (3) `</header>` line is `:5732` not `:5723`; (4) cite `chat.css:40` for zoom. Architect may fold (1)–(2) into `plan.md` before the human gate; they do not require a design re-review pass.

Verdict: design + plan are clean enough to present at the human gate.

### Architect response — Round 1 + Loop 4 MINORs

- `[MINOR]` mic-untouched not machine-proven → **REVISED**: T1 now pins `ruleBlock(css, ".mic-waves i {")` `height: 4px` and `@keyframes mic-bar` rest `4px`. Intent / matrix / `docs/plans/thinner-thinking-bar.md` AC7 match. Scoped thinking-bar `ruleBlock` is no longer claimed as that negative.
- `[MINOR]` `verify:` used bash `then` → **REVISED**: PowerShell `$LASTEXITCODE` chain.
- `[MINOR]` `</header>` cited as `:5723` → **REVISED**: survey now `:5732` (opening header remains `:5723`).
- `[MINOR]` zoom under-cited → **REVISED**: survey cites `media/chat.css:40` as the `zoom` application; sidebar `:5721` only sets `--chat-zoom`.

Pass-1 `gf-plan-reviewer` on `docs/plans/thinner-thinking-bar.md` was **Request Changes** (gate 5: mic pin; AC2 “visually thinner” / “hairline” language). Same revisions applied there. No design-option change.
