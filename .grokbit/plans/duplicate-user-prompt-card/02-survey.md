# Survey — Remove duplicate user prompt card

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Turn open / shell | EXISTS | `media/chat.js:2633-2678` (`openTurn`) |
| Turn header (chevron + summary) | EXISTS | `media/chat.js:2648-2660` (created always); CSS `media/chat.css:179-218` |
| Turn body / prompt / activity / answer regions | EXISTS | `media/chat.js:2662-2672`; CSS `media/chat.css:219-261` |
| User bubble render | EXISTS | `media/chat.js:2902-2908` (`addMessage` role `"user"` → `openTurn` + append `.msg.user` into `.turn-prompt`) |
| Live `userMessage` handler | EXISTS | `media/chat.js:5535-5557` |
| Replay `userMessageChunk` / `appendUserChunk` | EXISTS | `media/chat.js:4017-4088`; handler `5584-5585` |
| `setTurnSummary` | EXISTS | `media/chat.js:2570-2576` |
| `collapseTurn` / `expandTurn` | EXISTS | `media/chat.js:2578-2596` |
| Sticky active prompt CSS | EXISTS | `media/chat.css:228-235` (`.turn.active .turn-prompt`) |
| Active header styling (still visible) | EXISTS | `media/chat.css:198-201` (`.turn.active .turn-header`) |
| Collapsed body hide | EXISTS | `media/chat.css:225-227`; also `body.hidden` in `collapseTurn` (`media/chat.js:2592-2593`) |
| Prior design: active turn has **no** header in diagram | EXISTS (design doc) | `.grokbit/plans/chat-turn-containers/03-design.md:16-20` vs collapsed header at `:11-15` |
| Turn container DOM tests | EXISTS | `test/chat-turn-containers.dom.test.ts` (asserts both `.turn-prompt .msg.user` and `.turn-summary` on send, lines 14-25) |
| `makeCollapsible` for user msgs | EXISTS but skipped for turns | Comment at `media/chat.js:2915-2917`; CSS still present `media/chat.css:2660-2709` |
| Chat turn containers plan (implemented) | EXISTS | `.grokbit/plans/chat-turn-containers/` — progress all tasks done |

## Reusable code

- **`openTurn` / `collapseTurn` / `expandTurn` / `setTurnSummary`** — `media/chat.js:2570-2678` — full lifecycle for turn shells; fix should extend these rather than invent a parallel prompt card.
- **CSS class contracts** — `.turn.active`, `.turn.collapsed`, `.turn-header`, `.turn-prompt` — `media/chat.css:172-261`; a visibility rule on `.turn.active .turn-header` is the smallest reuse path.
- **DOM harness + turn tests** — `test/chat-turn-containers.dom.test.ts` + `test/webview-harness` (imported as `bootWebview`, `dispatch`, `click`) — extend assertions for “header not visible when active.”
- **Original design Option A** — `.grokbit/plans/chat-turn-containers/03-design.md:5-20` — already specified active turn as prompt/activity/answer only (no header row).

## Supersession

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Always-visible `.turn-header` on **active** turn | `media/chat.js:2648-2673` always appends header; CSS `media/chat.css:198-201` styles active header as still visible | Created once per `openTurn`; click no-ops when active (`media/chat.js:2656-2657`) | Duplicates the same prompt text already rendered as `.msg.user` in `.turn-prompt` (`media/chat.js:2905-2907`). Header is useful only when collapsed (and as accordion chrome for expanded prior turns). |
| Dual product surfaces for the same prompt (header summary + full bubble) on send | Same paths | Every live/replay user turn that calls `openTurn` + `addMessage("user")` | User-visible double card; conflicts with approved design diagram (active = no header). |
| Tests that require both surfaces without asserting single-visible-prompt | `test/chat-turn-containers.dom.test.ts:20-21` | 1 file primary; other DOM tests only check user text / turns exist | Assertions currently expect both `.msg.user` and `.turn-summary` content; need an explicit “header hidden while active” (or equivalent) so the bug cannot regress. |

Caller notes: `openTurn` is the single construction site for turn DOM (grep shows the function definition at `2633` and call sites via `addMessage` user path / `ensureActiveTurn`). `setTurnSummary` is called from `openTurn`, `addMessage` user path, and `appendUserChunk` — keep writing summary for collapse, even if header is hidden while active.

## Prior attempts

- **chat-turn-containers (approved + implemented)** — `.grokbit/plans/chat-turn-containers/`. Design said active turn has no header; implementation always mounts and shows the header. This bug is an implementation drift from that design, not a second competing feature.
- No alternate duplicate-prompt fix branch found in working tree plans.

## Conventions

- **Webview pure DOM policy:** layout/behavior in `media/chat.js` + `media/chat.css`; host does not know about turns.
- **Tests:** Vitest + happy-dom via `bootWebview` / `dispatch` — `test/chat-turn-containers.dom.test.ts:1-4`.
- **State:** `state.activeTurnEl` holds the live turn — `media/chat.js:129` (comment ~126-129 region).
- **Active header click:** early-return when `.active` — `media/chat.js:2656-2657` (header is inert while active today).

## Absences

- No CSS rule that hides `.turn.active .turn-header` (confirmed by reading `media/chat.css:172-261` — active header only changes cursor/border, not display).
- No DOM test asserting “one visible prompt surface” / header hidden while active.
- Coverage tool: NONE (project test commands). Lint: NONE.

## Danger zones

- `media/chat.js` — large webview controller; many DOM tests depend on message dispatch order. Prefer a narrow visibility/DOM fix over broad turn-model rewrite.
- Sticky + zoom: ADR 0002 forbids `@media` under `zoom`; any new rule must stay class-based (`:not(.active)` / `.collapsed`), not viewport breakpoints.
- Replay path (`appendUserChunk`) also calls `openTurn` via `addMessage("user")` — same double surface on restore for the non-collapsed last turn if not fixed at shell level.

## Root-cause summary (factual)

On each user send:

1. `userMessage` → `addMessage("user", …)` (`media/chat.js:5535-5547`).
2. `openTurn` builds **both** a `.turn-header` (chevron + `.turn-summary` with the prompt) **and** a `.turn-body` with empty `.turn-prompt` (`media/chat.js:2633-2678`).
3. The same function then appends a full `.msg.user` bubble into `.turn-prompt` and updates the summary again (`media/chat.js:2905-2908`).
4. While `.turn.active`, CSS does **not** hide the header (`media/chat.css:198-201`), and `.turn-body` is visible — so the user sees two cards with the same prompt.

Collapsed prior turns only show the header (body hidden) — that path is correct and is not the reported bug.
