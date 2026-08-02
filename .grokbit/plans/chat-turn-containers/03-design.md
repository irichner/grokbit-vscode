# Design — Chat turn containers & clean final answers

## Options

### Option A — Turn-container DOM model (recommended)

Introduce an explicit **turn** element as the unit of layout:

```
#messages
  .turn.collapsed          ← prior completed turns
    header (prompt summary + chevron)
    .turn-body (hidden)
      .turn-prompt
      .turn-answer
  .turn.active             ← current turn
    .turn-prompt           ← sticky within .messages
    .turn-activity         ← live carousel only
    .turn-answer           ← final agent bubble (and deliverable cards)
    [interactive cards as siblings under .turn while unresolved]
```

**Behavior mapping**

| Intent | Mechanism |
|---|---|
| DC1 sticky prompt | `.turn.active .turn-prompt { position: sticky; top: 0; z-index: … }` inside scrolling `.messages` |
| DC2 live carousel | Reuse `ensureActivityBlock` but parent under `.turn-activity` of the active turn |
| DC3/DC4 ephemeral work | On `commitAgentTurn` / successful seal: **remove** activity DOM (and thinking/tool nodes under it) instead of freezing `.done`; keep only `.turn-prompt` + `.turn-answer` |
| DC5/DC6 collapse stack | On next `userMessage`: mark previous `.turn` as `.collapsed`, hide `.turn-body`, show one-line header from prompt text; click toggles |
| DC7 replay | Same structure built from `userMessage`/`userMessageChunk` + agent/tool stream + `promptComplete` boundaries |
| DC8 cards | Unresolved permission/question/plan cards append under the **active turn** (outside ephemeral activity). They still call a boundary that closes the *live activity strip* but do **not** destroy the turn. After resolve, cards may collapse in place (existing collapse helpers) or be dropped when the final answer seals — prefer keep collapsed history line until turn seal if tests require ordering |

**Trade-offs**

- Pros: Matches product language (“containers”); sticky + collapse have a clear parent; supersedes freeze-summary cleanly; tests can query `.turn` structure.
- Cons: Largest edit surface in `media/chat.js`; every append path must target the active turn (or messages root for welcome); late `toolCallUpdate` after seal must no-op or attach only if row still exists (rows will be gone — **accept and update tests**: after seal, intermediate tools are gone by design, so late updates for discarded tools are ignored).

### Option B — CSS sticky + hide without turn wrappers

Keep flat `#messages` children. Make `.msg.user` sticky; on `finalizeActivity`, `el.remove()` instead of freeze; on new user message, walk previous siblings and wrap/hide ad hoc.

**Trade-offs**

- Pros: Smaller conceptual change; reuses flat stream.
- Cons: Sticky stacking of multiple user messages fights each other; “expand previous answer” requires fragile sibling walking (user bubble → following agent until next user); multi-segment turns (activity, card, more activity, answer) make “the answer” ambiguous without a container; higher bug rate for DC5–DC7.

### Option C — Keep freeze-summary carousel; only add collapse of whole history

Leave `finalizeActivity` as-is; add accordion only at session level.

**Trade-offs**

- Pros: Minimal change.
- Cons: Fails DC3/DC4 explicitly (done strips remain). Rejected against intent.

## Decision

**Choose Option A (turn-container DOM model).**

It is the only option that cleanly satisfies sticky active prompt, ephemeral intermediate work, and multi-turn expand/collapse without sibling heuristics. Rejected B for collapse fragility; rejected C for failing DC3/DC4.

Rejected options would have been better at: **B** smaller diff / less test rewrite; **C** zero risk to late toolCallUpdate attachment tests.

## Disposition table (from survey supersession)

| Item | Disposition | Reason |
|---|---|---|
| `finalizeActivity` freeze-to-`.done` summary | **REPLACE** | Product requires intermediate work to disappear (DC3/DC4). New seal path removes activity under the active turn. |
| Single-item unwrap leaving tool rows | **REPLACE** | Same — no permanent tool rows after seal. |
| Flat `#messages` as sole layout model | **REPLACE** (for chat turns) | Turn wrappers become the layout model for user-initiated turns. Welcome / onboarding remain outside turns. |
| Activity-carousel tests expecting permanent `.done` / unwrapped groups | **REPLACE** | Rewrite for ephemeral activity + turn structure. |
| Long-message `makeCollapsible` | **LEAVE** | Still useful for very long **prompt text inside** a prompt container; orthogonal to turn accordion. Ensure UI doesn’t show two unlabeled “Show more” controls competing — turn header owns expand/collapse of the **turn**; `makeCollapsible` only for overflow inside expanded prompt body if still needed. |
| Classic `compactActivity: false` stream | **COEXIST** (best-effort) | Keep setting; when off, still use turn wrappers for collapse/sticky if cheap, but allow classic tool rows **inside** `.turn-activity` without forcing ephemeral deletion… **Revision:** ephemeral deletion is the product default and applies whenever turn containers are on. Classic mode: **COEXIST** as “show intermediate rows until seal, still delete on seal” OR full classic stream without turn model. **Decision:** turn model is always on for user turns; `compactActivity` only controls whether live work is one strip vs expanded tool list **during** the turn; **both** delete intermediate on seal. Documents dual path without permanent freeze. |
| `activityPeek` / strip chrome | **LEAVE** (reuse) | Live strip still needed for DC2. |

## Architecture notes (implementers)

### State additions (webview only)

- `state.activeTurnEl` — current open turn element.
- Optional: `state.turns` not required if DOM is source of truth.

### Lifecycle

1. **`userMessage` / first bubble of turn:** `collapseActiveTurn()` if any; `openTurn(promptText, chips)` creates `.turn.active` with `.turn-prompt` container; sticky class on.
2. **Tools / thoughts / narration:** parent into `.turn-activity` (carousel when `compactActivity`, else classic list under same region).
3. **Interactive card:** close live strip (clear activity children or finalize-destroy live strip only); append card under `.turn` (not global `#messages` root) so it stays with the turn.
4. **Final answer:** `appendAgent` targets `.turn-answer` (create once). Narration that preceded tools still folds into activity (existing behavior) and dies with activity on seal.
5. **`promptComplete` / `commitAgentTurn`:** flush agent; **destroy** `.turn-activity` contents (and any thinking/tool nodes); leave prompt + answer; remove `.active` sticky-only flag or keep sticky until next user message.
6. **Next user message:** collapse prior turn (add `.collapsed`, hide body, header from prompt); open new turn.

### Distinguishing narration vs final answer

Existing carousel already treats “agent bubble followed by tools” as narration and folds it into activity (`media/chat.js:3098-3112`). Final answer is the agent bubble that survives until `promptComplete` without a following tool batch. **Seal rule:** on `commitAgentTurn`, anything still in `.turn-activity` is destroyed; `.turn-answer` / last agent bubble under the answer slot is kept. If the only agent text was folded into activity and nothing remains, leave prompt-only turn (valid for tool-only turns) — still DC4-compliant (no intermediate noise).

### Late tool updates after seal

By design, rows are gone. `toolItemsByToolCallId` entries should be cleared on activity destroy so late updates no-op safely. Update tests that currently require late attach after freeze.

### Sticky stacking

Only `.turn.active .turn-prompt` is sticky. Collapsed turns are not sticky (avoids multi-sticky pile-up). When user expands a prior turn mid-session, expanded body is in normal flow (may scroll); no requirement that expanded historical prompts stick.

### CSS / ADR 0002

- Sticky uses `position: sticky` inside `.messages` — no `@media`.
- Prompt container uses existing theme tokens + subtle border (evolve `.msg.user .msg-bubble` styles into `.turn-prompt`).
- Do not center-cap the turn stack.

### Host changes

None required for v1. Optional later: none.

### Docs

- Short CLAUDE.md bullet under Chat surfaces when implementing (out of plan file writes during implement).
- Consider tiny ADR amendment only if sticky + turn model is long-lived policy — optional, not blocking.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Replay builds wrong turn boundaries | Mirror live: every user bubble opens/continues a turn; `commitAgentTurn` seals |
| Cards orphaned outside turn | All card append paths take `activeTurnEl || messagesEl` helper |
| Permission tests break | Update selectors to `.turn .card` |
| Performance of many turns | Collapse hides body (`hidden` or `display:none`); no virtualization required for v1 |
| User confuses long-prompt Show more with turn expand | Turn header uses chevron + “Show answer”; long-prompt control only inside expanded prompt |

## Test strategy

- New `test/chat-turn-containers.dom.test.ts` for DC1–DC6 happy path via harness.
- Rewrite `test/activity-carousel.dom.test.ts` finalize section for destroy-on-seal.
- Keep permission/plan/question tests green with updated parent expectations.
- `npm test` as regression gate (DC9).
