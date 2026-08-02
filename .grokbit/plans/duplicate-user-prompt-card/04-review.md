# Review log — Remove duplicate user prompt card

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[MAJOR]` Expanded prior turns still show header summary + full prompt body — design marks this COEXIST, but DC1 says “the user prompt once” without limiting to active-only. If the human interprets DC1 globally, Option A is incomplete. — evidence: `01-intent.md` DC1 wording vs `03-design.md` COEXIST row — resolves by: either narrow DC1 in intent to **active/send** only (matches user report and assumptions), or extend design to hide summary text on expanded-but-not-collapsed turns and provide another collapse control.
- `[MAJOR]` Relying only on `display: none` means DOM tests that query `.turn-summary` text still pass even if CSS is regressed (deleted rule). — evidence: `test/chat-turn-containers.dom.test.ts:20-21` only checks textContent — resolves by: design already calls for a visibility assertion; make that assertion **mandatory** in the plan’s verify task (not optional notes).
- `[MINOR]` Dead `.turn.active .turn-header` cursor/border rules left as LEAVE — fine for scope, but if the CSS block is edited, delete them to avoid future “why is active header styled?” confusion.
- `[MINOR]` Spot-check: survey citation `openTurn` at `media/chat.js:2633-2678` matches; dual append path `2905-2908` matches; design diagram reference in prior plan is accurate.

### Architect response — Round 1
- `[MAJOR]` DC1 scope → **REVISED**: Intent DC1 clarified to **active turn after send** (and the live sticky surface). Expanded-prior dual chrome stays explicitly out of the bug scope (assumption already said so). Design/plan verification matrix use the narrowed DC1.
- `[MAJOR]` Test gap → **REVISED**: Plan T1 verify must include an assertion that the active turn’s `.turn-header` is not displayed (e.g. `getComputedStyle(...).display === "none"` or equivalent class contract). TextContent-only checks are not sufficient.
- `[MINOR]` Dead CSS → **ACCEPTED**: optional cleanup in the same CSS edit if adjacent; not a separate task.
- `[MINOR]` Spot-check → no change.

## Round 2
Reviewed: revised `01-intent.md` (pending apply), `03-design.md`

- `[MINOR]` Ensure collapse path does not leave `.active` on the prior turn (would keep header hidden after next send). Survey shows `collapseTurn` removes `.active` (`media/chat.js:2588-2590`) — no design change required; note in plan as regression guard in existing collapse test.

### Architect response — Round 2
- `[MINOR]` → **ACCEPTED**: existing collapse test + T1 notes cover class flip.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (MINORs accepted)

## Plan review (Loop 4)
Reviewed: `plan.md`

- `[MAJOR]` Verification matrix must map narrowed DC1 to a **visibility** assert, not only “summary text exists.”
- `[MINOR]` Single-task plan is appropriate for this blast radius; do not re-open full turn-container T1–T6.

### Architect response
- `[MAJOR]` → **REVISED**: T1 verify + matrix row require hidden active header + single visible `.msg.user` prompt.
- `[MINOR]` → **ACCEPTED**: one task (+ optional docs note only if needed).

Outcome: revised clean for gate
