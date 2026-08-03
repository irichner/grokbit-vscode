# Survey — Collapsible long user prompts

Every claim below was confirmed by opening the cited file in this session.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| User message bubble construction | EXISTS | `media/chat.js:3330-3421` (`addMessage`) |
| Live user send path | EXISTS | `media/chat.js:6231-6248` (`userMessage` → `addMessage("user", …)`) |
| Replay user path | EXISTS | `media/chat.js:4535-4607` (`appendUserChunk`; returns/uses `.body` from `addMessage`) |
| `makeCollapsible` helper | EXISTS | `media/chat.js:3296-3315` |
| Call sites of `makeCollapsible` | **zero live calls** | only a skip-comment at `media/chat.js:3418-3420` |
| Collapsible user CSS | EXISTS | `media/chat.css:2967-3021` (`.msg.user.collapsible .body`, `.msg-expand-btn`, `.msg-collapse-btn`) |
| Clamp height today | EXISTS | `max-height: 48px` at `media/chat.css:2969-2972` (≈ multi-line, **not** one line) |
| Expand button visibility | EXISTS | hover-only: `.msg.user.collapsible:hover .msg-expand-btn { display: block }` at `media/chat.css:3003` |
| Turn containers (prior-turn collapse) | EXISTS | `media/chat.js:2984-3153`, CSS `media/chat.css:282-306` |
| Active-turn sticky prompt | EXISTS | `.turn.active .turn-prompt` sticky `media/chat.css:292-298` |
| Active-turn header hidden (no dual prompt) | EXISTS | asserted in `test/chat-turn-containers.dom.test.ts:45-58`; design from prior plan `duplicate-user-prompt-card` |
| Turn summary one-liner | EXISTS | `setTurnSummary` truncates to 80 chars `media/chat.js:3044-3049` |
| User bubble structure | EXISTS | `.msg.user` → `.msg-bubble` → `.body` (+ optional images/chips) `media/chat.js:3343-3387` |
| User message max-width | EXISTS | `.msg.user` `min-width`/`max-width` ch clamps `media/chat.css:671-676`; turn-prompt stretches to full width `media/chat.css:302-306` |
| Markdown render for user body | EXISTS | `renderMarkdown` in `addMessage` `media/chat.js:3377-3379`; replay `media/chat.js:4598` |
| DOM test harness | EXISTS | `test/webview-harness` used by `test/chat-turn-containers.dom.test.ts` |
| Dedicated tests for user-body collapsible | DOES NOT EXIST | searched `test/**` for `makeCollapsible` / `msg-expand` / user collapsible — none |
| Setting for user prompt clamp | DOES NOT EXIST | no `grok.*` key for this behavior |

## Reusable code

Things that already do part of this job. Highest-value section.

- **`makeCollapsible(el, container)`** — `media/chat.js:3296-3315` — adds `.collapsible` on `el`, injects “Show more” / “Show less” toggle buttons into `container`. **Never called** after turn containers landed; logic still present.
- **CSS block “collapsible user messages”** — `media/chat.css:2967-3021` — `max-height` + gradient fade + expand/collapse button styles. Ready to retarget to one-line clamp.
- **Turn-header collapse** — `collapseTurn` / `expandTurn` — `media/chat.js:3052-3069` — different product surface (whole prior Q&A), not a substitute for in-bubble long-prompt clamp on the **active** sticky prompt.
- **`truncate(s, max)`** — `media/chat.js:381` — used for turn summary / chips, **not** for bubble body display; bubble keeps full markdown HTML.
- **DOM test patterns** — `test/chat-turn-containers.dom.test.ts` dispatches `userMessage` and queries `.turn-prompt .msg.user .body`; CSS contracts asserted via source-read of `chat.css` (happy-dom does not apply stylesheet engine fully).

## Supersession

What this change replaces, duplicates, or makes dead.

| Item | Location | Callers | Why superseded |
|---|---|---|---|
| Skip-`makeCollapsible` policy on user bubbles | `media/chat.js:3418-3420` comment + no call | 1 (the dead policy itself) | Turn header collapses **prior turns**, not the active sticky long prompt; user still sees full multi-line active bubble |
| `max-height: 48px` clamp (if re-enabled as-is) | `media/chat.css:2969-2972` | CSS only (no JS wire today) | Intent asks for **first line**, not ~2–3 lines at 48px |
| Hover-only expand button | `media/chat.css:3003` | CSS only | Discoverability / a11y; intent wants an explicit control without hover requirement |

No competing alternate helper for “clamp user bubble body” found elsewhere in `media/`.

## Prior attempts

- **In-repo half-ship:** `makeCollapsible` + CSS existed (pre–turn-container era; baseline note in `chat-turn-containers` plan T1 referenced `makeCollapsible` only). Turn-container work **deliberately skipped** re-wiring it so the turn header would own expand/collapse of prior Q&A (`media/chat.js:3418-3420`). Live product path: **full user body always shown** when the turn body is visible.
- **Turn-level collapse** is the live prior-turn solution; it does **not** solve long prompts on the active turn (header is `display:none` while active — `test/chat-turn-containers.dom.test.ts:45-49`).

## Conventions

- **Webview UI:** imperative DOM in `media/chat.js`; styles in `media/chat.css`; pure helpers in `media/webview-helpers.js` when shared with tests.
- **Tests:** Vitest + happy-dom via `bootWebview` / `dispatch` — `test/chat-turn-containers.dom.test.ts:1-6`. CSS behavior often asserted by reading CSS source when layout engine is insufficient (`ruleBlock` helper `:16-24`).
- **No `@media` in chat.css** — project rule (CLAUDE.md / ADR 0002); use intrinsic CSS (`line-clamp`, `max-height` in em/ch, not viewport breakpoints).
- **Theme tokens:** expand/collapse buttons already use `--vscode-editorWidget-*` / `--vscode-foreground` (`media/chat.css:2982-3020`).
- **User bubble chrome:** copy + timestamp under `.msg-actions` (`media/chat.js:3389-3402`).

## Absences

- No overflow measurement helper (scrollHeight vs clientHeight) wired for user prompts today — old `makeCollapsible` always added `.collapsible` without checking overflow.
- No DOM tests for `msg-expand-btn` / user collapsible class.
- happy-dom may not compute real `scrollHeight` for multi-line text reliably — tests may need class/contract assertions + forced multi-line text, or pure helper for “shouldCollapse(text)” if measurement is flaky.

## Danger zones

- **`media/chat.js` `addMessage` / `appendUserChunk`** — central path for all user bubbles; wrong wire breaks turn containers and replay.
- **Replay path** — `appendUserChunk` sets `state.activeUserEl.innerHTML` on the **returned `.body`** after `addMessage("user", "")` (`media/chat.js:4588-4598`); collapsible must apply **after** final body content is known (end of user chunk stream / when next turn starts), not only on empty initial body.
- **Sticky `.turn.active .turn-prompt`** — a tall collapsed control must still leave room for activity/answer; clamp height is the whole point.
- **Duplicate affordances** — collapsed prior turn already has header expand; expanded prior body with in-bubble collapse is OK if not confusing (two different scopes: turn vs body).
- **Images/chips** sit outside `.body` in the bubble (`media/chat.js:3357-3387`) — clamping `.body` only leaves chips/images visible; confirm product acceptance (non-goal says leave chips/images).
