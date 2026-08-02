# Design — Remove duplicate user prompt card

## Options considered

### Option A — Hide header while turn is active (CSS + test; keep DOM for collapse)

**Approach:** Keep creating `.turn-header` in `openTurn` (so `setTurnSummary` / collapse still have a target), but hide it with CSS while the turn is `.active`:

```css
.turn.active .turn-header { display: none; }
```

When `collapseTurn` removes `.active` and adds `.collapsed`, the header becomes the sole prompt surface; body stays `hidden`. Expanding a prior turn shows header (accordion control) + body again.

**Trade-off:** Smallest change; aligns with approved turn-container design diagram (active = no header row — `.grokbit/plans/chat-turn-containers/03-design.md:16-20`). Expanded prior turns can still show header summary + full prompt (acceptable per intent assumption). Does not remove header nodes from the DOM (screen readers / tests may still find `.turn-summary` unless tests check visibility).

### Option B — Defer header creation until collapse

**Approach:** `openTurn` builds only body regions; `collapseTurn` injects (or unhides) the header from stored prompt text. Expand/collapse toggles body only.

**Trade-off:** Cleaner active DOM (no hidden inert control). More JS churn: every collapse path must ensure header exists; replay multi-turn must not double-create; risk of missing header on edge collapse paths. Higher bug surface for a visual-only fix.

### Option C — Drop full `.msg.user` bubble; header-only prompt always

**Approach:** Active turn shows only the chevron/summary card as the prompt; no second bubble.

**Trade-off:** Matches a literal reading of “remove the second card,” but breaks sticky full-prompt styling, copy/timestamp actions on the user bubble, multi-line prompt readability, and the prior design’s “sticky `.turn-prompt`” product (DC2 / chat-turn-containers DC1). Rejected against constraints and the `UNVERIFIED` assumption that the full sticky prompt survives.

## Decision

**Chosen: Option A**

Rationale against constraints:

- Fixes DC1 with minimal blast radius in `media/chat.css` (+ targeted tests; optional small JS only if tests need a class/aria hook).
- Preserves sticky `.turn-prompt` (DC2) and collapse-on-next-send (DC3/DC4).
- Matches the already-approved active-turn structure (no header in the design diagram).
- Avoids Option B’s lifecycle edge cases and Option C’s product regression.

What the rejected options were better at:

- **B** — cleaner active DOM tree (no display:none header).
- **C** — zero chance of two text surfaces if someone forgets CSS; worse product fit.

## Shape of the change

1. **CSS:** Hide `.turn.active .turn-header` (`display: none`). Keep existing sticky rule on `.turn.active .turn-prompt` (`media/chat.css:228-235`). Optionally drop or leave the now-unused “active header” border/cursor rules at `media/chat.css:198-201` (dead while hidden; safe LEAVE or small cleanup).
2. **JS:** No structural rewrite required for the happy path. `openTurn` may keep creating the header; `collapseTurn` already flips classes so the header reappears. Confirm click handler still no-ops when active (`media/chat.js:2656-2657`) — redundant once hidden but harmless.
3. **Tests (`test/chat-turn-containers.dom.test.ts`):**
   - On first `userMessage`: assert exactly one visible prompt surface — e.g. `.turn-header` is not displayed while `.active` (via `getComputedStyle` or a class contract), and `.turn-prompt .msg.user` still contains the text.
   - Keep collapse/expand tests: after second send, prior turn’s header is visible and body hidden; expand still reveals answer.
   - Existing assertions that only check `.turn-summary` **textContent** remain valid (node still in DOM).
4. **Replay:** Same shell classes — no separate host path. DC5 covered by reusing shell fix + existing replay test.

No new modules, settings, or host messages.

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Always-visible active `.turn-header` | **REPLACE** (behavior) | Duplicate prompt on send; design said active has no header | Active turns must not show the header; summary still stored for collapse |
| Dual prompt surfaces on send | **REPLACE** (UX contract) | User-reported bug | One visible prompt on active turn |
| Tests without single-visible-prompt check | **REPLACE** (assertions) | Current tests allow the bug | Add visibility assertion; keep collapse coverage |
| `.turn.active .turn-header` style block (cursor/border) | **LEAVE** or trivial cleanup | Harmless once hidden; optional delete if touching same CSS block | Not required for DC1 |
| Full `.msg.user` in `.turn-prompt` | **LEAVE** | Remains the active prompt surface (Option C rejected) | — |
| Header on collapsed prior turns | **LEAVE** | Correct accordion chrome | — |
| Header on expanded prior turns | **COEXIST** (intentional) | Accordion control + body; not the reported bug | Documented; no second product mode |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Active turn, long multi-line prompt | Full bubble in sticky `.turn-prompt` only; no second header strip |
| Next send collapses prior | Prior header appears (no longer `.active`); body hidden; summary text already set |
| Expand prior turn | Header visible as control + body (prompt + answer); optional residual summary echo accepted |
| Replay multi-turn | Collapsed priors show headers; last active/open turn follows same active hide rule |
| `ensureActiveTurn` without user text | Header (if any) still hidden while active; summary may be “Message” until text arrives — pre-existing edge |
| `compactActivity` on/off | Unrelated; only header visibility changes |
| Permission/plan cards | Still under turn surface; not inside header |

## Migration

Schema change: no  
Reversible: yes (`git revert` / restore CSS)  
Existing rows: n/a (webview only)  
Mixed-version window: n/a

## New dependencies

None.
