# Survey — Switch Agents on any tab and retain context

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution
| Entity | Status | Location |
|---|---|---|
| `switchBackend` host handler | EXISTS | `src/sidebar.ts:618-649` |
| History-loss modal on flip | EXISTS | `src/sidebar.ts:621-628` (`History can't carry over between backends…`) |
| Webview `switchBackend` posts | EXISTS | `media/chat.js:523`, `media/chat.js:563` (setup/chip paths) |
| Message type union | EXISTS | `src/sidebar.ts:136` (`switchBackend`) |
| `startSession` buffer wipe | EXISTS | `src/sidebar.ts:2134` (`session.buffer = []`) + `hasHistory = false` at `:2159` |
| Same-backend restart + summarize | EXISTS | `src/sidebar.ts:2051-2103` (`pickRestartMode` / `restartSession`) |
| Hidden context inject pattern | EXISTS | `src/sidebar.ts:2090-2102` (`[Context from previous session]` + `suppressContent`) |
| UI banner for context applied | EXISTS | `media/chat.js:3791-3798`, `media/chat.js:6048-6059` (`summarizing` / `sessionContext`) |
| `Session.buffer` / router emit | EXISTS | `src/session.ts` buffer field region; `src/panel-router.ts:74-106` |
| Per-backend session stores | EXISTS | `src/session-store.ts` (Grok + Claude); resume routing `src/sidebar.ts:687+` |
| Cross-backend history carry non-goal (prior plan) | EXISTS | `docs/plans/claude-code-backend.md:44` |
| Empty-flip discard | EXISTS | `src/sidebar.ts:655-669` (`discardAbandonedBackendSession`) |
| Actions-on-flip related plan | EXISTS (shipped plan) | `.grokbit/plans/actions-survive-agent-switch/` — UI capabilities only, not transcript |
| Pure handoff transcript builder | DOES NOT EXIST | searched: `handoff`, `buildHandoff`, `transcriptFromBuffer`, `Context from previous` (only summarize inject) |
| Cross-backend `session/load` | DOES NOT EXIST | load is same-backend only (`src/acp.ts:281+` `session/load`; WP5 resume per store) |

## Reusable code
Things that already do part of this job.

- **`restartSession` summarize path** — `src/sidebar.ts:2066-2103` — captures a short agent summary, restarts process, injects suppressed `[Context from previous session]` prompt, posts `sessionContext` banner. Same-backend only today; buffer still wiped by `startSession` (`:2134`), so hide/reveal after summarize is lossy for UI.
- **`pickRestartMode`** — `src/sidebar.ts:2051-2058` — “Summarize & Restart” / “Just Restart” dialog for model/effort; pattern for optional user choice, **not** used by `switchBackend`.
- **`PanelRouter.emit` / `replayInto`** — `src/panel-router.ts:74-106` — buffer is the source of truth for visible history after reveal; preserving buffer across flip is mandatory for “hide/reveal keeps transcript.”
- **`discardAbandonedBackendSession`** — `src/sidebar.ts:655-669` — only safe for empty/primer flips; must **not** run for history flips.
- **`backendChanged` webview handling** — `media/chat.js:5670+` — updates labels; Actions retention fixed in `actions-survive-agent-switch` (do not reintroduce wipe).
- **`session-context-banner` CSS** — `media/chat.css:2772` — existing chrome for handoff messaging.

## Supersession
What this change replaces, duplicates, or makes dead.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| History-loss modal copy + fresh-only path | `src/sidebar.ts:621-628` | 1 (`switchBackend`) | Product requires carry-context on history tabs |
| Claim “Not carrying conversation history across a backend flip” | `docs/plans/claude-code-backend.md:44` | doc-only | Becomes false once feature ships; update or annotate as historical non-goal |
| User-facing warning string | same modal | 1 | Replace with carry-context behavior (and optional softer confirm) |
| Implicit “buffer discard on every startSession” for backend flip | `src/sidebar.ts:2134` via `switchBackend` → `startSession` | flip path | Need preserve/reseed buffer for agent switch only (not necessarily all starts) |

Caller counts capped by single-function ownership of the modal; webview posts `switchBackend` from multiple UI mounts but all funnel to one host method.

## Prior attempts
- **Claude Code backend WP3** — deliberately **non-goal** to carry history across flip (`docs/plans/claude-code-backend.md:44`); implemented modal + fresh session (`src/sidebar.ts:618-649`). Live code uses this.
- **Model/effort Summarize & Restart** — same-backend partial context; live in `restartSession`. Closest implementation, but not full transcript and not buffer-preserving.
- **actions-survive-agent-switch** — keeps Grokbit Actions visible on flip; unrelated to conversation context.

## Conventions
How this repo actually works, with an example of each.

- **Errors:** host `emit` of `{type:"error", text}` / onboarding cards for missing CLI/adapter — `src/sidebar.ts:2210+`, `:2780+`.
- **Tests:** vitest, pure modules + happy-dom DOM tests under `test/`; host `sidebar.ts` orchestration is mostly unmocked (documented in claude plan) — e.g. `test/backend-chip.dom.test.ts` posts `switchBackend` from webview only.
- **State:** `Session` bag + `PanelRouter` buffer; `hasHistory` gates empty discard and first-send telemetry — `src/session.ts:119`, `src/sidebar.ts:4365+`.
- **Layout:** no new panel types; reuse session-context banner in chat scroll area.
- **Pure-first:** extract policy into pure functions + unit tests (same discipline as `panel-router`, `session-pool`).

## Absences
- No pure “serialize buffer → handoff text” helper.
- No `startSession({ preserveBuffer })` (or equivalent) flag.
- No automated test that asserts host `switchBackend` modal text or buffer preservation (webview-only tests for the post).
- Coverage tool: NONE (project test commands).

## Danger zones
- `src/sidebar.ts` `startSession` — central; wrong preserve flag can leak state (plan gate, priming, voice) across backends.
- Buffer message shape is heterogeneous (`userMessage`, chunks, tool calls, cards); naive JSON dump may be huge or unreadable to the new agent.
- Injected handoff prompt counts toward context and costs tokens on first turn after switch.
- `retainContextWhenHidden:false` — if buffer is empty after flip, reveal wipes UI even if DOM looked fine before hide.
- Do not call `discardAbandonedBackendSession` when `wasEmpty === false`.
