# Intent — Collapsible long user prompts

## Problem

When a user sends a long prompt, the full text fills a large portion of the chat surface (especially on the active sticky turn). That pushes agent work and answers off-screen and makes multi-turn history hard to scan. Long prompts should show a single-line preview by default, with an explicit expand/collapse control to reveal or hide the rest.

## Done criteria

Each item must be checkable by a human performing an observable action (or by a DOM test that mirrors that action).

- [ ] **DC1 — Long prompt collapsed by default:** After sending a multi-line (or otherwise taller-than-one-line) user prompt, the visible user-bubble text is limited to approximately **one line**, not the full body.
- [ ] **DC2 — Expand control present when collapsed:** A clear control (e.g. “Show more” / expand) is available without relying on hover alone, so keyboard and non-hover users can expand.
- [ ] **DC3 — Expand reveals full prompt:** Activating expand shows the complete prompt text (same content as today, including markdown rendering already used for user bubbles).
- [ ] **DC4 — Collapse returns to one line:** After expand, a collapse control (e.g. “Show less”) restores the one-line preview.
- [ ] **DC5 — Short prompts unchanged:** A single short line does **not** show expand/collapse chrome and is fully visible without clipping.
- [ ] **DC6 — Live and replay parity:** Restored/replayed long user prompts use the same collapse default as live sends.
- [ ] **DC7 — Turn collapse still works:** Prior-turn accordion (header summary + expand whole turn) continues to work; this feature does not replace or break it.
- [ ] **DC8 — Regression floor:** `npm test` stays green, including `test/chat-turn-containers.dom.test.ts` and any new tests for this behavior.

## Non-goals

- Collapsing agent replies, thinking traces, tool groups, or activity carousels.
- Changing composer input behavior (drafting long text is still full-height as today).
- Truncating or rewriting the prompt text sent to the agent (display-only).
- New settings / config keys for clamp length (hard-code one-line product rule unless proven insufficient).
- Redesigning turn containers, sticky prompt, or dual-prompt header policy.
- Host/ACP/session-store changes.
- Collapsing image attachments or file chips (only the text body of the user prompt).

## Constraints

- Stack: VS Code webview (`media/chat.js`, `media/chat.css`); grok-free Vitest + happy-dom DOM tests.
- Must not break: turn open/collapse, sticky active prompt role, single user bubble per active turn, copy action, chips/images on user bubbles, primer-only restore.
- No new dependencies; prefer existing `makeCollapsible` / CSS hooks if still correct after survey.
- User OS / CI: Windows + Ubuntu CI both run `npm test`.
- No `@media` queries in `chat.css` (project invariant under `grok.chatFontScale` zoom).

## Assumptions

Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “First line” means **one visual line of display height** (CSS line-clamp / equivalent), not only “text before the first `\n`”. A long unwrapped sentence that wraps to many visual lines should also clamp.
- `UNVERIFIED` Default state for a long prompt is **collapsed**; expand is opt-in per bubble and does not need to persist across session reload (reload may re-collapse).
- `UNVERIFIED` Applies to **active sticky prompts and expanded prior-turn prompt bodies** equally whenever the bubble is visible and content exceeds one line.
- `UNVERIFIED` Hover-only expand is insufficient; control should be discoverable without hover (accessibility).

## Questions asked

None — product rule is clear enough for a bounded webview display change; remaining choices recorded as assumptions above.

## Scope note

`scope: standard` — multi-file webview UI + tests, but small blast radius and existing half-implemented collapsible path. Full pipeline with short design options, not a trivial one-liner.
