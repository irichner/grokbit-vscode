# Intent — Chat turn containers & clean final answers

## Problem

Long agentic turns scroll the chat so hard that the user’s own prompt leaves the viewport, intermediate tool/agent noise piles up under every answer, and older turns stay fully expanded in one long transcript. The session tab should feel like a stack of clean Q&A containers: the current prompt stays visible, live work is a single-line carousel that vanishes when done, only the final answer remains with that prompt, and earlier turns collapse but stay reopenable.

## Done criteria

Each item must be checkable by a human performing an observable action (or by a DOM test that mirrors that action).

- [ ] **DC1 — Prompt container at top:** After sending a message, the user’s prompt is rendered as a distinct container (not a free-floating bubble lost in the stream). While that turn is active, the prompt stays visible at the top of the chat body without scrolling the prompt out of view to follow live activity.
- [ ] **DC2 — Live activity carousel under the prompt:** While the agent is working, tool/agent activity appears under that prompt as a single-line carousel (one row). Completed intermediate steps do not accumulate as permanent transcript rows under the answer.
- [ ] **DC3 — Finished intermediate work disappears:** When an intermediate activity unit finishes (or when the turn’s final answer lands), that intermediate work no longer remains as a permanent “done” summary strip or tool-group row in the transcript for that turn.
- [ ] **DC4 — Clean final surface:** When the turn completes successfully with a final assistant answer, the turn shows the user prompt container and the final answer only — no frozen activity carousel summary, no thinking rows, no tool groups for that turn.
- [ ] **DC5 — Prior turn collapses on next send:** When the user sends another prompt in the same session, the previous prompt + its final answer collapse into a compact header above the new turn. Expanding that header reveals the prior answer again; collapsing hides it.
- [ ] **DC6 — Multi-turn stack:** A session with three completed turns shows three collapsible prior headers (or two collapsed + one active) and does not force the user to scroll through full historical tool traces to find answers.
- [ ] **DC7 — Resume/replay parity:** Restoring a session (or replaying buffer into a revealed tab) reconstructs the same turn-container model: prior turns collapsible with answers, no permanent intermediate tool walls for completed turns.
- [ ] **DC8 — Interactive cards still work:** Permission, question, and plan-review cards still appear and remain actionable until the user answers; they are not permanently lost behind a carousel that auto-deletes them mid-interaction.
- [ ] **DC9 — Regression floor:** `npm test` stays green (current suite floor; update tests that encode the old “freeze summary in transcript” contract).

## Non-goals

- Redesigning the composer, model/effort chips, backend switcher, status-bar HUD, or launcher history.
- Changing ACP protocol, host buffering (`panel-router`), or session disk format.
- Building a full nested subagent inspector tree (child process tool trees).
- Persisting expandable “activity logs” for completed turns (by design, intermediate work is discarded from the UI surface after the final answer).
- Changing plan-mode gate logic, primer behavior, or onboarding cards.
- Adding a new Marketplace setting unless required as an escape hatch (prefer evolving existing `grok.compactActivity` rather than inventing a third layout mode).
- Mobile / non–VS Code webview ports.
- Voice UI, media generation UX, or Docs popover redesign.

## Constraints

- Stack: VS Code webview (`media/chat.js`, `media/chat.css`, pure helpers in `media/webview-helpers.js`); grok-free Vitest + happy-dom DOM tests.
- Must not break: permission / plan / question cards; primer-only welcome restore; `retainContextWhenHidden:false` replay path; changed-files strip; copy actions on final answers.
- No host schema migration; pure webview layout policy preferred.
- User OS: Windows (verify commands must work in this repo’s shell/CI: `npm test`).
- Layout policy in ADR 0002 still applies: no `@media` breakpoints under `zoom`; no re-centering a narrow chat ribbon.

## Assumptions

Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` Expanding a **previous** turn shows **user prompt + final answer only** (not tools/thinking). Matches DC3/DC4 and “see their answers.”
- `UNVERIFIED` “Agent finishes, it disappears” means intermediate activity is **ephemeral**: live carousel tracks in-flight work; completed intermediate rows are removed (or never left as permanent transcript), not frozen into a permanent summary strip as today.
- `UNVERIFIED` Sticky “prompt at top” applies to the **active** turn’s prompt container within the messages viewport (CSS sticky / structural pin). Collapsed prior turns sit above it in document order and may scroll away when many turns exist — only the active prompt is required to stay pinned while that turn is live.
- `UNVERIFIED` Interactive cards (permission / question / plan) stay visible and actionable until resolved even if they temporarily sit outside the ephemeral activity strip; after the turn’s final answer, resolved cards for that turn are not required to remain (history already has collapse patterns).
- `UNVERIFIED` Deliverable surfaces that are the user’s outcome (generated media cards, business document cards, the final markdown answer) count as “final answer surface,” not intermediate activity.
- `UNVERIFIED` Classic streaming mode (`grok.compactActivity: false`) may remain as an escape hatch if cheap; default path implements turn containers. If dual-mode cost is high, classic mode may be left as best-effort rather than fully re-specified.

## Questions asked

None this round — done criteria are observable from the four product rules in the request; remaining ambiguities are recorded as assumptions above.
