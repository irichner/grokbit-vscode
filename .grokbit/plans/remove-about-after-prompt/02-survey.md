# Survey — Stop showing About Grokbit after a prompt is submitted

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Welcome markup with About link | EXISTS | `src/sidebar.ts:4793-4800` (`#welcome`, `#welcome-about-link`) |
| Harness mirror of About byline | EXISTS | `test/webview-harness.ts:34-40` |
| `.welcome` layout CSS (`display: flex`) | EXISTS | `media/chat.css:265-272` |
| `.welcome-byline` CSS | EXISTS | `media/chat.css:281` |
| `.welcome[hidden] { display: none }` | DOES NOT EXIST | searched: `welcome[hidden]`, `.welcome[hidden]` — no matches |
| Other `[hidden]` overrides (same gotcha) | EXISTS | e.g. `media/chat.css:109-111` (`.toolbar-popover[hidden]`), `1444`, `1682`, `1694`, `1913`, `1939`, `1954`, `2464` |
| `clearWelcome()` | EXISTS | `media/chat.js:2459-2466` — sets `welcome.hidden = true`, `state.welcomeVisible = false`, hides setup + capabilities |
| First-send path calling `clearWelcome` | EXISTS | `media/chat.js:2602` inside `openTurn` (also many other call sites) |
| `openAboutPanel` + welcome link wiring | EXISTS | `media/chat.js:2127-2134`, `5861-5862` |
| Gear → Version & about | EXISTS | `media/chat.js:1931`, `renderAboutPanel` at `1945+` |
| Welcome re-show on reset / onboarding | EXISTS | `media/chat.js:2658-2670` (`resetForNewSession`), `2706-2708` (`showOnboarding`) |
| DOM test asserting About on empty canvas | EXISTS | `test/welcome-canvas.dom.test.ts:38-41` |
| Tests checking `.hidden` after send | EXISTS | `test/session-setup.dom.test.ts:107-111`, `test/primer-only-restore.dom.test.ts:57` — assert `hidden` **property**, not computed `display` |
| Prior plan keeping About on empty canvas | EXISTS | `.grokbit/plans/welcome-chrome-simplify/01-intent.md:25` (non-goal: do not remove About below cards) |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- **`[hidden]` + author `display` override pattern** — `media/chat.css:109-111` documents the exact failure mode: author `display:flex` beats the UA `[hidden]{display:none}` rule. Documented fix is element-specific `.foo[hidden] { display: none; }`. Same pattern on session-setup (`1913`), capabilities (`1954`), model/backend labels (`1682`/`1694`).
- **`clearWelcome()`** — `media/chat.js:2459-2466` already sets the `hidden` attribute; it does not need new JS if CSS honors `[hidden]`.
- **`hideSessionSetupCard` / `hideCapabilitiesPanel`** — already called from `clearWelcome`; those mounts have working `[hidden]` CSS overrides, which is why only the bare title + About byline remain visible after send.

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Broken reliance on UA `[hidden]` alone for `#welcome` | `media/chat.js:2462` + `media/chat.css:265-272` | 1 hide path + restore paths | Author `display:flex` means `hidden=true` is a no-op for layout; needs explicit CSS override like siblings |
| About link itself (product surface) | `src/sidebar.ts:4800` | wiring `media/chat.js:5861-5862`; test `welcome-canvas.dom.test.ts:38-41` | **Not superseded by default** — prior plan intentionally kept empty-canvas About; post-submit bug is hide failure. Only superseded if human chooses full removal |

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- `welcome-chrome-simplify` (`.grokbit/plans/welcome-chrome-simplify/`) — shipped simplified empty canvas (title only above cards); **kept** About byline; did not add `.welcome[hidden]`. Live code uses that simplified markup.
- Multiple existing `[hidden]` overrides in `chat.css` prove the team already fixed this class of bug for other elements; welcome was missed.

## Conventions
How this repo actually works, with an example of each.

- **Errors:** N/A for pure CSS visibility.
- **Tests:** Vitest + happy-dom driving real `media/chat.js` via `test/webview-harness.ts` — e.g. `test/welcome-canvas.dom.test.ts:13+`, `test/session-setup.dom.test.ts:107+`.
- **State:** `state.welcomeVisible` + `element.hidden` — `media/chat.js:49`, `2459-2466`.
- **Layout:** Author styles use `display: flex` on containers that toggle with `hidden`; must pair with `.x[hidden] { display: none }` — documented at `media/chat.css:109-111`.
- **Verify shell:** Windows repo; `npm test` from root (AGENTS.md / project test commands).

## Absences
Missing infrastructure the plan may need to add.

- No existing test that asserts **computed style** `display: none` on `#welcome` after first send — current tests only check the `hidden` **boolean**, which is already true while the element still paints (happy-dom may or may not compute cascade the same as Chromium; the production VS Code webview is Chromium).
- No `.welcome[hidden]` rule today (root cause).

## Danger zones
- `media/chat.js` — large webview controller; prefer **not** changing hide/show JS if CSS alone fixes it.
- `src/sidebar.ts` `getHtml` + `test/webview-harness.ts` — must stay in markup parity when HTML changes.
- Primer-only restore (`test/primer-only-restore.dom.test.ts`) depends on welcome remaining visible when only primer content is suppressed — must not break re-show / keep-visible paths.
