# Plan — Simplify session-tab welcome chrome

Slug: `welcome-chrome-simplify` · Approach: delete logo/tagline/version/guide above `#welcome-grid`; keep "Grokbit" + Session Setup + Actions · Blast radius: ~8 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Strip welcome markup above the cards
- **intent:** Session-tab welcome HTML contains only the Grokbit title above `#welcome-grid` (no logo, tagline, version, or guide mounts).
- **files:** `src/sidebar.ts`, `test/webview-harness.ts`
- **cwd:** none
- **depends:** none
- **verify:** From repo root: `rg "welcome-mark|welcome-tagline|welcome-version|welcome-guide" src/sidebar.ts test/webview-harness.ts` returns no matches; `rg "Grokbit" src/sidebar.ts` still shows the welcome `h2`; `rg "welcome-grid|session-setup-card|capabilities-panel|welcome-about-link" src/sidebar.ts test/webview-harness.ts` still matches. (PowerShell alternative if `rg` missing: `Select-String -Path src/sidebar.ts,test/webview-harness.ts -Pattern 'welcome-mark|welcome-tagline|welcome-version|welcome-guide'` → empty.)
- **removes:** markup for `.welcome-mark`, `.welcome-tagline`, `#welcome-version`, `#welcome-guide` from `getHtml` and harness BODY
- **baseline:** empty-session welcome order (logo → title → tagline → version → guide → grid → onboarding → about); harness BODY mirror of mounts
- **rollback:** `git checkout -- src/sidebar.ts test/webview-harness.ts`
- **state-after:** working (chat.js null-guards tolerate missing nodes; suite may fail until T2–T3 update tests)
- **notes:** Keep `<h2>Grokbit</h2>`, `#welcome-grid` children, `#welcome-onboarding`, About byline. Do not touch launcher logo markup.

### T2 — Remove guide/version JS lifecycle and dead helper
- **intent:** No runtime code renders or updates the removed chrome; dead pure helper is gone; priming busy/voice flush still works.
- **files:** `media/chat.js`, `media/webview-helpers.js`
- **cwd:** none
- **depends:** T1
- **verify:** `Select-String -Path media/chat.js,media/webview-helpers.js -Pattern 'welcomeGuide|hideWelcomeGuide|renderWelcomeGuide|welcome-version|startingPhase'` returns no matches; `Select-String -Path media/chat.js -Pattern 'flushVoiceQueue'` still matches; `Select-String -Path media/chat.js -Pattern 'cliVersion'` still matches (About). Full suite is T3 (helper unit tests deleted there).
- **removes:** `hideWelcomeGuide`, `renderWelcomeGuide`, all call sites; all `#welcome-version` writers; `state.startingPhase`; `welcomeGuide` function + export; import destructure of `welcomeGuide`
- **baseline:** guide strip on ready session; version line Starting → hide after priming; onboarding still sets version status strings
- **rollback:** `git checkout -- media/chat.js media/webview-helpers.js`
- **state-after:** working once T3 tests updated; intermediate may red on guide/version suites
- **notes:** Design Option A + disposition REPLACE for guide/version. Keep `showOnboarding` card HTML and hide of setup/capabilities. Keep gear About path.

### T3 — CSS cleanup + rewrite tests for absence
- **intent:** Styles and automated tests match the simplified canvas; suite proves chrome is gone and cards/onboarding still work.
- **files:** `media/chat.css`, `test/welcome-canvas.dom.test.ts`, `test/webview-ui.dom.test.ts`, `test/webview-helpers.test.ts`, `test/chat-layout.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npm test` (full suite, repo root, Windows) — all green. Additionally: `Select-String -Path media/chat.css -Pattern 'welcome-mark|welcome-tagline|welcome-guide'` empty; new/updated welcome-canvas tests assert no logo/tagline/version/guide nodes and h2 Grokbit precedes `#welcome-grid`.
- **removes:** `.welcome-mark`, `.welcome-tagline`, `.welcome-guide`, `.welcome-guide-row` CSS; `welcomeGuide` unit describe; version-line DOM describe cases that require `#welcome-version`; guide lifecycle cases that require `#welcome-guide` (replace with absence + keep starter-chip non-resurrection `[R]` where still valid)
- **baseline:** prior DOM assertions for guide rows, version lifecycle, tagline max-width regression
- **rollback:** `git checkout -- media/chat.css test/welcome-canvas.dom.test.ts test/webview-ui.dom.test.ts test/webview-helpers.test.ts test/chat-layout.dom.test.ts`
- **state-after:** working
- **notes:** Onboarding describe in `webview-ui.dom.test.ts` that asserts card content (not only version line) stays. Optional: tighten `.welcome` padding — only if suite stays green. Do not delete `blackhole-icon.svg` or launcher styles.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Only "Grokbit" above Session Setup / Actions | T1 markup order + T3 welcome-canvas absence/order tests |
| No logo on session welcome | T1/T3 no `.welcome-mark` |
| No tagline | T1/T3 no `.welcome-tagline`; chat-layout retargeted |
| No welcome guide | T1–T3 no `#welcome-guide` / `welcomeGuide` |
| No Starting/Updating status line on ready (and removed entirely) | T1–T3 no `#welcome-version`; T2 removes writers |
| Session Setup + Actions still work | T3 full `npm test` (session-setup + capabilities DOM suites unchanged mounts) |
| Onboarding still usable | T3 retained onboarding card tests + T2 keeps `showOnboarding` cards |
| `npm test` green | T3 verify |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 6 | T1 (markup), T2 (JS/helper), T3 (CSS + tests) for mark, tagline, version, guide mount, welcomeGuide, guide CSS |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 1 | ADR/CLAUDE.md guide prose — optional docs follow-up, no task |

Net lines: expected net-negative (chrome removal + test rewrite). Not an all-additive plan.

## Open assumptions
This is a pointer, not a copy — the full ledger is `assumptions.md`.

- `UNVERIFIED` session tabs only (not launcher)
- `UNVERIFIED` keep About byline + onboarding below cards
- `UNVERIFIED` full status-line removal (including priming/update) is intentional

## Approval
- [x] Human approved — 2026-08-01 (via `/grokbit-implement this plan`)
