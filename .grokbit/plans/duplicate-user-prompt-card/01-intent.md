# Intent — Remove duplicate user prompt card

## Problem

When the user sends a prompt, the chat shows two stacked cards with the same text: a turn header with an expand/collapse chevron and summary, and a second full user-message bubble underneath. That double rendering is noise and makes the new turn-container UI look broken. After a send, the user should see their prompt once.

## Done criteria

Each item must be checkable by a human performing an observable action (or by a DOM test that mirrors that action).

- [ ] **DC1 — Single prompt on the active turn after send:** After sending a message, the **active** turn shows the user prompt **once** as the full sticky user bubble — not a turn-header card *and* a separate user bubble with the same text. (Scope is the active/send surface; accordion chrome on expanded prior turns is out of this bug’s done-criteria.)
- [ ] **DC2 — Sticky / active prompt still works:** While the turn is active, the user’s prompt remains the sticky working surface at the top of the messages area (same product role as today — one prompt surface, not none).
- [ ] **DC3 — Prior turns still collapse:** On the next send, the previous turn collapses to a one-line header (chevron + truncated prompt). Expanding that header reveals the prior prompt body and final answer.
- [ ] **DC4 — Expand control only where needed:** The expand/collapse affordance is for **prior** (collapsed/expandable) turns, not a redundant second card on the active turn.
- [ ] **DC5 — Replay parity:** Restored/replayed history does not reintroduce a double prompt for the active or last open turn, and collapsed prior turns still show a single-line header.
- [ ] **DC6 — Regression floor:** `npm test` stays green, including `test/chat-turn-containers.dom.test.ts` and other DOM tests that create user messages.

## Non-goals

- Redesigning the whole turn-container model (sticky activity, seal-to-answer-only, multi-turn stack) beyond fixing the duplicate prompt surface.
- Changing composer, host ACP path, session disk format, or plan/permission cards.
- Removing the ability to expand prior turns or see full prior prompt + answer.
- Reintroducing permanent tool/activity walls after seal.
- New settings or Marketplace options.
- Mobile / non–VS Code ports.

## Constraints

- Stack: VS Code webview (`media/chat.js`, `media/chat.css`); grok-free Vitest + happy-dom DOM tests.
- Must not break: turn seal (ephemeral activity gone after complete), sticky active prompt, collapse-on-next-send, permission/plan/question cards under the turn, primer-only welcome restore.
- No host/schema changes; pure webview layout/DOM policy.
- User OS / CI: Windows + Ubuntu CI both run `npm test`.
- Prefer the already-approved turn-container design (active turn = prompt body only; collapsed prior = header only) over inventing a third layout mode.

## Assumptions

Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “Remove the second one” means remove the **redundant** surface on the **active** turn so prompt text appears once. The surviving surface for an active turn is the full sticky user prompt (not a header-only strip), matching the prior turn-container design diagram.
- `UNVERIFIED` For an **expanded prior** turn, a compact header (accordion control) above the full prompt body is acceptable even if summary text echoes the prompt — the user’s reported bug is the active-send double card. If cheap, header may remain visible on expanded prior turns for collapse UX.
- `UNVERIFIED` Completed active turn (answer landed, user has not sent again) still counts as “active” for layout until the next send — same as current `state.activeTurnEl` / `.turn.active` behavior.

## Questions asked

None this round — the bug is observable, the desired outcome is “one prompt card,” and remaining product choices are recorded as assumptions above.
