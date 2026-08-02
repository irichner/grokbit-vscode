# Plan — Remove duplicate user prompt card

Slug: `duplicate-user-prompt-card` · Approach: Option A — hide `.turn-header` while `.turn.active` (CSS + regression tests) · Blast radius: ~3 files (`media/chat.css`, `test/chat-turn-containers.dom.test.ts`, optionally `media/chat.js` only if a class hook is needed), 0 new deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Hide active turn header; assert single visible prompt
- **intent:** On the active turn after send, show only the full sticky user prompt bubble — not a second header card with the same text; keep collapse/expand for prior turns.
- **files:** `media/chat.css`, `test/chat-turn-containers.dom.test.ts` (optional touch: `media/chat.js` only if a dedicated class/aria hook is required beyond `.turn.active`)
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/chat-turn-containers.dom.test.ts` (must include: after `userMessage`, active `.turn-header` is not displayed / `display === "none"`, and exactly one `.turn-prompt .msg.user` carries the prompt; after second send, prior turn is `.collapsed` with visible header and hidden body; expand still shows prior answer)
- **removes:** Visible dual-prompt UX on active turns (behavior); optionally dead active-header chrome rules if cleaned in the same CSS edit
- **baseline:** Active turn currently shows both `.turn-header` (chevron + summary) and `.turn-prompt .msg.user` with the same text (`media/chat.js:2633-2678`, `2905-2908`; `media/chat.css:198-201` leaves header visible). Capture: one send → two prompt-like cards.
- **rollback:** `git revert` the commit for this task
- **state-after:** working
- **notes:** Survey root cause in `02-survey.md`. Prefer CSS: `.turn.active .turn-header { display: none; }` — matches approved diagram in `.grokbit/plans/chat-turn-containers/03-design.md:16-20`. Do not remove header from DOM construction (collapse needs `.turn-summary`). Do not drop `.msg.user` (Option C rejected). Regression: `collapseTurn` must still remove `.active` so the prior header reappears (`media/chat.js:2588-2590`). Expanded prior dual chrome is COEXIST / out of DC1 scope.

### T2 — Full suite green
- **intent:** Ensure no other DOM tests assume a visible active header or break on the CSS change.
- **files:** any `test/*.dom.test.ts` that fails only if assertions need updating (prefer zero production changes)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test`
- **removes:** none
- **baseline:** Full suite green before change (project floor; chat-turn-containers suite already present)
- **rollback:** `git revert` range
- **state-after:** working
- **notes:** Expect most tests unaffected (they dispatch `userMessage` without querying header visibility).

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 Single prompt on active turn after send | T1 verify (header not displayed + one `.msg.user`) |
| DC2 Sticky active prompt still works | T1 (sticky class/CSS contract on `.turn.active .turn-prompt` unchanged; prompt bubble present) |
| DC3 Prior turns still collapse | T1 verify (second send → prior `.collapsed` + visible header) |
| DC4 Expand control only where needed | T1 (header hidden while active; present when collapsed) |
| DC5 Replay parity | T1 existing replay case + shell-level CSS applies to replay-built turns; T2 suite |
| DC6 `npm test` green | T2 verify |

## Disposition summary

Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T1 (active header visibility, dual prompt UX, test assertions) |
| DEPRECATE | 0 | — |
| COEXIST | 1 | Expanded prior header + body (documented, no task) |
| LEAVE | 3 | Full `.msg.user` prompt; collapsed header; optional dead active-header styles |

Net lines: expect roughly +15–40 / −0–10 (CSS + tests). Not additive product surface — removes a duplicate UX.

## Open assumptions

Pointer to `assumptions.md`:

- Active turn keeps full sticky bubble (not header-only)
- Expanded prior dual chrome acceptable
- Active until next send (existing class model)

## Approval

- [x] Human approved — 2026-08-01 (user: `/grokbit-implement this plan`)
