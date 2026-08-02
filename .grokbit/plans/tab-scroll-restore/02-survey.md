# Survey — Session tab scroll position restore

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| Messages scroll container (`#messages`) | EXISTS | `src/sidebar.ts:4805` (HTML), scroll APIs in `media/chat.js:4226–4268` |
| `state.stickToBottom` | EXISTS | `media/chat.js:228–234`, reset `media/chat.js:2692` |
| `shouldStickToBottom` pure helper | EXISTS | `media/webview-helpers.js:168–172` |
| `scrollToBottom` / `forceScrollToBottom` | EXISTS | `media/chat.js:4226–4246` |
| Scroll listener + scroll-to-bottom button | EXISTS | `media/chat.js:4248–4268`, CSS `media/chat.css:1395–1431` |
| `retainContextWhenHidden: false` (session panels) | EXISTS | `src/sidebar.ts:712–717` |
| `ready` → config → `replayInto` on reveal | EXISTS | `src/sidebar.ts:2727–2735` |
| `markHidden` when panel not visible | EXISTS | `src/sidebar.ts:749–756`, `src/panel-router.ts:69–72` |
| `PanelRouter.replayInto` (clear + buffer + derived) | EXISTS | `src/panel-router.ts:100–106` |
| `Session.buffer` | EXISTS | `src/session.ts:232–238` |
| `Session.ready` | EXISTS | `src/session.ts:253–259` |
| `clearMessages` → `resetForNewSession` | EXISTS | `media/chat.js:5763–5765`, `media/chat.js:2680–2696` |
| `historyReplay` (session/load only) | EXISTS | host emit `src/sidebar.ts:2527–2544`; webview `media/chat.js:5521–5534` |
| Webview `setState` (id + backend only) | EXISTS | `media/chat.js:5356` |
| Host `WebviewMsg` union | EXISTS | `src/sidebar.ts:116+` |
| Scroll state on `Session` | DOES NOT EXIST | searched: `scrollTop`, `scrollState`, `stickToBottom` under `src/session.ts` — only webview `state.stickToBottom` |
| Persist-scroll-on-hide path | DOES NOT EXIST | no host message for scroll; `visibilitychange` only closes popovers `media/chat.js:6052–6054` |
| Tests for stick-to-bottom | EXISTS | `test/webview-helpers.test.ts:366–390`, `test/webview-ui.dom.test.ts:1129–1156` |
| Launcher `retainContextWhenHidden: true` | EXISTS | `src/extension.ts:87` (launcher view only — not session tabs) |

## Reusable code
Things that already do part of this job. Highest-value section — this is what stops reinvention.

- `shouldStickToBottom(scrollTop, scrollHeight, clientHeight, threshold?)` — `media/webview-helpers.js:168–172` — pure “near bottom?” predicate (default threshold 40). Already unit-tested. Use for restore decisions and for interpreting saved metrics; do not reimplement.
- `scrollToBottom()` — `media/chat.js:4226–4228` — no-ops when `!state.stickToBottom`. Live streaming already respects mid-scroll; the bug is that **reveal always re-enables stick** via reset.
- `forceScrollToBottom()` — `media/chat.js:4242–4246` — re-pins for interactive activity (user send, permission/question). Keep as the override path.
- Scroll-button visibility tied to `!state.stickToBottom` — `media/chat.js:4235–4237` — restore must call `updateScrollBtn()` after applying position.
- Capabilities popover scroll preserve pattern — `media/chat.js:984–990` / `1034` — same idea (save `scrollTop` across DOM rebuild) but for a small popover body; proves the product already uses “save then reapply scrollTop” in one place.
- `PanelRouter.replayInto` derived-messages slot — `src/panel-router.ts:100–106` — already posts mode/chips/backend **after** buffer (`src/sidebar.ts:4366–4371`). Natural place to append a scroll-restore message without inventing a second replay API.
- Continuous host posts from webview (chips, mode, etc.) — existing `vscode.postMessage` + `onMessage` switch — pattern for a new `scrollState` inbound message.
- happy-dom scroll metrics stubbing — `test/webview-ui.dom.test.ts:1130–1134` — same technique for restore tests.

## Supersession
What this change replaces, duplicates, or makes dead. Caller counts are required.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Unconditional `state.stickToBottom = true` on every `clearMessages` / `resetForNewSession` | `media/chat.js:2692` | 1 definition; `clearMessages` is the sole path into full reset used by **every** tab reveal (`panel-router.ts:103`) and by intentional clears | Must stop treating “DOM rebuild after hide” as “fresh session pinned to bottom.” New/resume intentional clears still want pin-to-bottom. |
| Implicit “always end at bottom after buffer replay” | many `scrollToBottom()` call sites in `media/chat.js` (e.g. message/tool paths ~2860–4176, 4639+) | ≥50 (capped) — grepped `scrollToBottom()` in `media/chat.js` | Call sites stay; behavior becomes conditional on restored `stickToBottom` / pending-restore flag, not a rewrite of every call site. |
| Lack of host-held scroll memory | `src/session.ts` has buffer but no scroll fields | n/a | Not code to delete — a gap to fill so tear-down can restore. |

No second scroll-restore subsystem exists to replace; this is additive policy on the existing stick-to-bottom design (#16).

## Prior attempts
Earlier implementations of this same idea. Say which one live code actually uses.

- Live mid-session stick-to-bottom (#16) is fully implemented and works **while the webview stays alive** (`media/chat.js:4223–4261`).
- No prior attempt found for **persist-across-hide** scroll (no TODOs/FIXMEs naming tab scroll restore in session/chat modules; no plan slug for this in `.grokbit/plans/` before this one).
- `retainContextWhenHidden: false` is deliberate and documented as load-bearing for `ready`→replay (`src/panel-router.ts:19–24`, `src/sidebar.ts:712–716`, CLAUDE.md Known limits). Live code uses false for session tabs.

## Conventions
How this repo actually works, with an example of each.

- **Errors:** host message handlers catch and log rather than crash the extension host — `src/sidebar.ts:741–748`.
- **Tests:** vitest, grok-free; pure helpers in `test/webview-helpers.test.ts`; DOM via `test/webview-harness.ts` + `*.dom.test.ts` driving real `media/chat.js`. Scroll tests stub `scrollTop`/`scrollHeight`/`clientHeight` — `test/webview-ui.dom.test.ts:1130–1134`.
- **State:** webview owns UI state (`state.*` in `media/chat.js`); host owns durable session process + `Session.buffer` for lossless reveal — `src/session.ts:232–238`. Ephemeral per-panel config is re-posted on every `ready` — `src/sidebar.ts:4319+`.
- **Layout:** pure policy in `src/*` and `media/webview-helpers.js`; impure glue in `sidebar.ts` / `chat.js`.
- **Commands:** `npm test` (Windows-friendly); single package, cwd repo root.

## Absences
Missing infrastructure the plan may need to add.

- No host field or message for scroll position (`scrollState` / `restoreScroll`).
- No “panel reveal replay in progress” flag on the webview for buffer replay (unlike `historyReplay` for session/load).
- No Coverage / Lint tooling in project test commands (AGENTS.md: Coverage NONE, Lint NONE) — verify via `npm test` + targeted files.

## Danger zones
- `media/chat.js` — large webview surface; many `scrollToBottom()` call sites. Prefer a single gate (stick flag / pending restore) over editing every caller.
- `retainContextWhenHidden` — `src/sidebar.ts:712–717` — do not flip casually; breaks `ready`/replay contract (`src/panel-router.ts:19–24`).
- `resetForNewSession` / `clearMessages` — shared by reveal replay, new session, resume clear; restore policy must distinguish “rebuild after hide” from “intentional empty”.
- `Session.buffer` growth while hidden — content height on restore can exceed last `scrollHeight`; absolute `scrollTop` still keeps earlier content in place when growth is at the bottom only (normal chat append).
