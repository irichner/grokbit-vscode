# Plan — Thinner thinking bar

Slug: `thinner-thinking-bar` · Approach: replace `.thinking-bar` `height: 4px` with `2px`; pin in the existing CSS source-check · Blast radius: 2 files (`media/chat.css`, `test/chat-layout.dom.test.ts`), 0 deps, schema no

## Tasks

### T1 — Thin the thinking bar to 2px and pin it
- **intent:** Make the live neon thinking strip half as tall (2px) without changing motion, tokens, or visibility, and make a restore of 4px fail CI.
- **files:** `media/chat.css`, `test/chat-layout.dom.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/chat-layout.dom.test.ts test/thinking-bar.dom.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx tsc -p . --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test`
- **removes:** `none` (in-place value replace on `.thinking-bar` only: `height: 4px` → `height: 2px`)
- **baseline:** Unlocked-busy `#thinking-bar` is a 4px ink-token gradient strip (`media/chat.css` `.thinking-bar {` `height: 4px`). Visibility suite in `test/thinking-bar.dom.test.ts` green. Motion source-check asserts animation / 0.6s / ink tokens / `[hidden]` / reduced-motion / `@media` count 2 — **not** height. Mic equalizer `.mic-waves i` remains `height: 4px` with **no** test pin today.
- **rollback:** Restore `height: 4px` on `.thinking-bar` and drop the new height / mic assertions from `test/chat-layout.dom.test.ts`.
- **state-after:** working
- **notes:** Edit **only** the `.thinking-bar {` rule (`media/chat.css` ~3098-3110). Do not global-replace `height: 4px`. Do not touch JS, markup, `[hidden]`, thinking-bar keyframes, or reduced-motion. In `describe("thinking-bar motion (source check)")`: (1) after `ruleBlock(css, ".thinking-bar {")`, assert `rule` contains `height: 2px` and does **not** contain `height: 4px`; (2) `ruleBlock(css, ".mic-waves i {")` contains `height: 4px`; (3) `@keyframes mic-bar` still has `height: 4px` at rest. (2)+(3) are the mic done-criterion — a scoped thinking-bar `ruleBlock` does **not** prove the equalizer is untouched. Verify is PowerShell (`$LASTEXITCODE`), not bash `then`. Coverage: CSS + test pin → **UNMEASURED / no changed executable lines**. After implement, Lead UI verify (`NO UI TOOLING`): at 100% zoom the strip is a **2px** band; at 60% `--chat-zoom` it remains visible (~1.2px); reduced-motion still shows a static 2px gradient. Target `2px` unless the human overrides at the gate.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| `.thinking-bar {` is `height: 2px`, not `4px` | T1 `ruleBlock(css, ".thinking-bar {")` |
| At 100% zoom the live strip is a 2px band; at 60% zoom still visible | T1 CSS `2px` + Lead UI verify (`NO UI TOOLING`) — names 2px, not “hairline” |
| Motion / ink tokens / 0.6s unchanged | T1 keeps existing motion assertions; CSS edit is height-only |
| Visibility policy unchanged | T1 does not touch JS; `test/thinking-bar.dom.test.ts` in T1 verify |
| `[hidden]` + reduced-motion + `@media` count 2 | Existing `test/chat-layout.dom.test.ts` cases in T1 verify |
| Mic equalizer 4px untouched | T1 `ruleBlock(css, ".mic-waves i {")` contains `height: 4px` + `mic-bar` rest `4px` |
| Targeted vitest + `tsc` + `npm test` green | T1 verify (PowerShell `$LASTEXITCODE`) |

## Disposition summary

Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 | T1 — `.thinking-bar` `height: 4px` → `2px` |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 4 | historical plan 4px spec; mic-waves 4px; activity-strip; JS/markup/a11y |

Net lines: ~+4 / −1 (one CSS token swap; thinking-bar height pin + mic-waves / mic-bar pins). Not silently COEXIST: the old 4px on this rule is REPLACE.

## Open assumptions

Pointer to `assumptions.md`:

- `UNVERIFIED` surface is `#thinking-bar` not activity-strip / mic-waves
- `UNVERIFIED` height **2px** (gate may say 1px or 3px)
- `UNVERIFIED` visual thinness is Lead UI verify (`NO UI TOOLING`)

## Approval

- [x] Human approved — 2026-08-22 (user: “approve”; 2px confirmed by proceeding with plan default)
