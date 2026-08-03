# Design — Collapsible long user prompts

## Options

### Option A — Revive and fix existing `makeCollapsible` + CSS (recommended)

Wire the dormant helper into user-bubble construction; retarget CSS from `max-height: 48px` to a **one-line** clamp (`-webkit-line-clamp: 1` / `line-clamp: 1` with `overflow: hidden` and display `-webkit-box`); only apply when content actually overflows one line; make expand always visible when collapsed (not hover-only).

- **Pros:** Reuses survey-found code and styles; minimal new surface area; matches existing button class names/tests can target; keeps full markdown in DOM when expanded.
- **Cons:** Old helper always collapsed without overflow check — must fix that; replay path needs a second apply after body fills; happy-dom may make overflow tests flaky (mitigate with pure predicate + class contract tests).

### Option B — New pure helper + always-on line-clamp without reusing old helper

Extract `shouldCollapseUserPrompt(text)` / `applyUserPromptCollapse(msgEl)` into `webview-helpers.js`, delete or ignore `makeCollapsible`, rewrite CSS from scratch.

- **Pros:** Cleaner unit-testable pure core; clearer API.
- **Cons:** Reinvents what already exists in-repo (survey: `makeCollapsible` + CSS); more churn for same UX; violates “prefer extending survey finds.”

### Option C — First **logical** line only (JS string split on `\n`)

Collapsed state replaces body with plain first line + ellipsis; expand restores full markdown.

- **Pros:** Easy pure tests; no layout measurement.
- **Cons:** Long single-paragraph wraps still fill the screen (fails screen-space intent); loses markdown in collapsed state; worse for pasted prose without newlines.

## Decision

**Option A** — revive `makeCollapsible`, fix clamp to one visual line, gate on overflow, apply on live + replay user bubbles, improve expand discoverability.

Rejected Option B as unnecessary reinvention. Rejected Option C because “first line” for screen space is visual height, not only `\n` (intent assumption).

## Chosen behavior (product)

| State | Behavior |
|---|---|
| Short prompt (fits one visual line) | No `.collapsible`, no expand button |
| Long prompt (overflows one line) | Default collapsed: one-line clamp + “Show more” |
| Expanded | Full body + “Show less” |
| Prior turn collapsed via turn header | Unchanged; when expanded, in-bubble clamp still applies if long |
| Session restore | Re-collapse long prompts (no persistence of expanded) |

## Implementation shape

### CSS (`media/chat.css`)

1. Change `.msg.user.collapsible .body` from `max-height: 48px` to one-line clamp:
   - `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden;`
   - Keep or simplify gradient `::after` (optional with line-clamp; may drop if redundant).
2. `.msg-expand-btn`: always `display` when parent is collapsible (not only `:hover`). Position so it does not steal the whole bubble (e.g. under body or trailing control in bubble). Prefer layout that works at any `zoom` without `@media`.
3. Expanded state: no `.collapsible` on msg (existing toggle) → full body; collapse button remains as today (`.msg-collapse-btn`).

### JS (`media/chat.js`)

1. **`userPromptNeedsCollapse(bodyEl)`** (local or pure export): after layout, `scrollHeight > clientHeight + ε` with temporary clamp class, **or** a text heuristic fallback when measurement is 0 in tests: count newlines or length > N. Prefer measurement when available; document fallback for happy-dom.
2. **`applyUserPromptCollapse(msgEl)`**: finds `.body` and bubble/container; if needs collapse and not already wired, call improved `makeCollapsible(msgEl, bubble)`.
3. **Live path:** end of `addMessage` for `role === "user"` after append — `requestAnimationFrame` or double-rAF so layout exists, then apply. (Turn open already appends into `.turn-prompt`.)
4. **Replay path:** after `appendUserChunk` updates body (or when user bubble finalizes — e.g. next agent start / commit), re-run apply on that msg. Safest: apply on every chunk after content set (idempotent), and once when leaving user stream.
5. **Idempotency:** do not stack multiple expand buttons on re-apply.
6. **Do not** apply to agent messages.

### Tests

- New `test/user-prompt-collapse.dom.test.ts` (or extend turn-containers):
  - Multi-line `userMessage` → `.msg.user.collapsible` + expand btn + body has clamp class/CSS contract.
  - Short message → no collapsible.
  - Click expand → class removed / full text; click collapse → back.
  - Second message still works with turn collapse (DC7).
  - CSS source asserts `line-clamp` / `-webkit-line-clamp: 1` (not 48px) for collapsible body.
- Keep `npm test` green for `chat-turn-containers`.

## Disposition table (from survey supersession)

| Item | Disposition | Reason |
|---|---|---|
| Skip-`makeCollapsible` policy (`chat.js:3418-3420`) | **REPLACE** | Policy is wrong for active sticky long prompts; remove skip-comment and wire apply |
| `max-height: 48px` clamp rule | **REPLACE** | Replace with one-line `line-clamp` to match DC1 |
| Hover-only expand | **REPLACE** | Always-visible expand when collapsed (DC2) |
| Turn-header collapse | **LEAVE** | Different surface; still required for prior Q&A (DC7) |
| `makeCollapsible` function name/body | **COEXIST → evolve in place** | Keep function; improve overflow gating + call sites rather than parallel helper (not permanent dual API — single evolved helper) |

Net: no permanent dual collapse systems for the same surface — one in-bubble clamp + existing turn accordion for different scopes.

## Unhappy paths

| Case | Handling |
|---|---|
| Empty / whitespace-only prompt | No collapse chrome |
| Prompt is only images + chips, empty body | No collapse on empty body |
| Markdown multi-paragraph | Clamp still one visual line when collapsed; expand shows full HTML |
| Font scale zoom | `line-clamp` / em-based rules scale with zoom; no `@media` |
| Expand then new turn | Prior turn collapses via turn model; in-bubble state discarded with body hide (ok) |
| Measurement fails (scrollHeight 0) | Text heuristic fallback so long multi-line still collapses in tests/real edge cases |

## Blast radius

- Files: `media/chat.js`, `media/chat.css`, new/updated DOM test(s); possibly tiny pure helper in `media/webview-helpers.js` if overflow/heuristic is extracted.
- Deps: 0. Schema: no. Host: no.
