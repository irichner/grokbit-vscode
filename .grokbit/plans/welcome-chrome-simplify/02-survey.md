# Survey — Simplify session-tab welcome chrome

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Session-tab welcome root `#welcome` | EXISTS | `src/sidebar.ts:4793` (`getHtml`) |
| Logo mark `.welcome-mark` | EXISTS | markup `src/sidebar.ts:4794`; CSS `media/chat.css:271-280` |
| Title `h2` "Grokbit" | EXISTS | `src/sidebar.ts:4795`; CSS `media/chat.css:281-288` |
| Marketing `.welcome-tagline` | EXISTS | markup `src/sidebar.ts:4796`; CSS `media/chat.css:289-295` |
| Status `#welcome-version` | EXISTS | markup `src/sidebar.ts:4797`; lifecycle writes in `media/chat.js` (`initialized` ~5383, `cliUpdating` ~5400, `setBusy` hide ~5810, `showOnboarding` ~2754+, `resetForNewSession` ~2709) |
| Guide `#welcome-guide` | EXISTS | markup `src/sidebar.ts:4798`; render/hide `media/chat.js:687-710`; CSS `media/chat.css:1877-1891` |
| Pure `welcomeGuide()` | EXISTS | `media/webview-helpers.js:879-892`; unit tests `test/webview-helpers.test.ts:1297+` |
| `#welcome-grid` + Session Setup + Actions | EXISTS | `src/sidebar.ts:4799-4801`; CSS `media/chat.css:1917+` |
| Onboarding mount `#welcome-onboarding` | EXISTS | `src/sidebar.ts:4803`; `showOnboarding` `media/chat.js:2744+` |
| About byline `#welcome-about-link` | EXISTS | `src/sidebar.ts:4804`; click → `openAboutPanel` `media/chat.js:5943-5944`; gear About `media/chat.js:1972+` / `1986+` |
| Test harness BODY mirror | EXISTS | `test/webview-harness.ts:21-68` (must stay in sync with `getHtml` mounts chat.js queries) |
| Welcome-guide DOM suite | EXISTS | `test/welcome-canvas.dom.test.ts` (entire file owns guide mount lifecycle) |
| Welcome-version DOM suite | EXISTS | `test/webview-ui.dom.test.ts:767-828` |
| Tagline layout regression | EXISTS | `test/chat-layout.dom.test.ts:40-41` (asserts `.welcome-tagline` has no `320px`) |
| Launcher logo (out of intent) | EXISTS | `src/sidebar.ts:4893` `.launcher-logo` — separate surface |
| Blackhole asset | EXISTS | referenced via `resourceUri("blackhole-icon.svg")` in welcome mark and launcher; shared asset, not welcome-only |

## Reusable code

Things that already do part of this job. Highest-value section — this is what stops reinvention.

- **Null-safe DOM pattern** — chat.js consistently uses `if (!el) return` / `if (ver) { … }` for welcome mounts (e.g. `media/chat.js:693-694`, `2754-2755`, `5383-5384`). Removing markup is safe if all writers stay null-tolerant; prefer deleting writers too so dead code does not accumulate.
- **About via gear** — `renderAboutPanel` / gear item "Version & about" (`media/chat.js:1972`, `1986+`) already exposes extension + CLI version; comment at `media/chat.js:5807-5808` states the welcome version line is intentionally empty after priming because version lives in About. Safe to drop `#welcome-version` without losing version discoverability.
- **Onboarding cards already self-title** — each `showOnboarding` branch sets an `.onb-heading` (e.g. "Install the Grok CLI" `media/chat.js:2766`, "Sign in to continue" `:2781`, Claude variants `:2799`, `:2814`) **and** also sets `#welcome-version` text to a short status string (`:2760`, `:2778`, `:2796`, `:2811`). The card headings already carry the primary message; the version-line status is redundant for human comprehension (tests still assert the version line for onboarding at `test/webview-ui.dom.test.ts:819-828`).
- **DOM harness** — `bootWebview` in `test/webview-harness.ts` is the shared entry for all chat.js DOM tests; update its `BODY` in the same change as `getHtml` or mounts disappear and guide/version tests fail for the wrong reason.

## Supersession

What this change replaces, duplicates, or makes dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| `.welcome-mark` (logo) | `src/sidebar.ts:4794`, CSS `media/chat.css:271-280` | markup only (no JS id); CSS rules only | Intent: no logo above cards |
| `.welcome-tagline` | `src/sidebar.ts:4796`, CSS `media/chat.css:289-295` | markup; CSS; source check `test/chat-layout.dom.test.ts:40-41` | Intent: no marketing copy above cards |
| `#welcome-version` | markup + `media/chat.js` writers (grep: ~8 sites in chat.js) + `test/webview-ui.dom.test.ts:767-828` | lifecycle status + onboarding status + tests | Intent: strip status above cards; About + onboarding card cover the job |
| `#welcome-guide` + `hideWelcomeGuide`/`renderWelcomeGuide` | markup; `media/chat.js:687-710` and call sites (`initialized` 5393, `setBusy` 5830, `modeChanged`/`backendChanged` ~5439/5464, clear/reset/onboarding) | DOM suite `test/welcome-canvas.dom.test.ts` | Intent: no guide strip above cards |
| `welcomeGuide()` pure helper | `media/webview-helpers.js:879-892` | exported; unit tests `test/webview-helpers.test.ts:1297+`; chat.js import destructure `media/chat.js:1145` | Only consumer is the guide strip; becomes dead if mount removed |
| `.welcome-guide` / `.welcome-guide-row` CSS | `media/chat.css:1877-1891` | only guide mount | Dead after mount removal |
| ADR/docs prose describing guide-on-canvas | e.g. `docs/adr/0002-…`, `CLAUDE.md` welcome-guide bullets | documentation only | Not runtime; optional LEAVE/docs follow-up |

Caller search for `renderWelcomeGuide` / `hideWelcomeGuide` / `welcome-version` was full-repo grep (under 50 matches, not capped).

## Prior attempts

Earlier implementations of this same idea. Say which one live code actually uses.

- Starter cards / task chips (`#welcome-starters`, `.welcome-starter`, `.welcome-task-chip`) were already removed; regression guards remain in `test/welcome-canvas.dom.test.ts:69-74` and friendly-ui tests (referenced in comments). Live code does **not** resurrect them.
- Full-canvas layout WP1/WP3 (`docs/plans/session-tab-ux-overhaul.md`) **added** `#welcome-guide` and kept tagline/logo; this plan **narrows** that chrome rather than reverting the full-canvas grid layout (`#welcome-grid` stays).

## Conventions

How this repo actually works, with an example of each.

- **UI markup ownership:** Host builds static HTML in `GrokSidebar` `getHtml` (`src/sidebar.ts` ~4785+); webview fills dynamic mounts in `media/chat.js`.
- **Pure helpers for testability:** View-model text like `welcomeGuide` lives in `media/webview-helpers.js` so unit tests can assert without happy-dom (`test/webview-helpers.test.ts:1297+`).
- **DOM tests drive real chat.js:** `test/webview-harness.ts` + happy-dom; harness BODY is a hand-maintained mirror of mounts (comment at `test/webview-harness.ts:20`).
- **Null-safe mounts:** Missing ids fail soft (`if (!el) return`) — still keep harness/getHtml in sync so tests don't silently skip assertions.
- **Regression tests marked `[R]`:** Source/CSS checks (e.g. tagline no 320px) in `test/chat-layout.dom.test.ts:40-41`.
- **Shell/OS for verify:** Windows host; suite is `npm test` (vitest, grok-free) per `CLAUDE.md` / project test commands.
- **No new deps for webview CSS/JS changes.**

## Absences

Missing infrastructure the plan may need to add.

- No visual snapshot/screenshot test for welcome chrome — verification is DOM/source assertions + human eyeball.
- No separate storybook; harness is the fixture.

## Danger zones

- `media/chat.js` — large webview controller; many lifecycle call sites for guide/version; edits must be complete or leave orphan writers.
- `test/webview-harness.ts` — shared by many DOM suites; breaking BODY breaks unrelated tests.
- `docs/adr/0002-session-tab-layout-and-empty-canvas-policy.md` — records "render locked not hidden" and guide strip as product policy; implementation can remove guide without rewriting the whole ADR, but implementers should not reintroduce the guide as "required by ADR" without reading this plan.
- Do **not** delete `blackhole-icon.svg` or launcher `.launcher-logo` — still used outside welcome (`src/sidebar.ts:4893`).
