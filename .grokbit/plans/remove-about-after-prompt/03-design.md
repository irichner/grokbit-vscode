# Design — Stop showing About Grokbit after a prompt is submitted

## Options considered

### Option A — Add `.welcome[hidden] { display: none; }` (match existing pattern)
Approach: One CSS rule next to other `[hidden]` overrides so `clearWelcome()`’s existing `welcome.hidden = true` actually stops painting. Keep About on empty welcome; gear About unchanged.
Trade-off (against the intent's constraints): Minimal blast radius (1 CSS rule + tests). Fixes **all** leftover welcome chrome after send (About **and** the Grokbit heading), which matches done-criteria. Does not remove About from empty state (prior product choice).

### Option B — Remove the About byline from markup only
Approach: Delete `#welcome-about-link` from `getHtml`, harness, click wiring, and welcome-canvas test expectation.
Trade-off: Removes the link on empty welcome too (product change beyond the reported symptom). **Does not** fix the underlying `[hidden]` bug — the Grokbit `h2` would still show after send. Incomplete against done-criteria unless paired with A.

### Option C — Change `clearWelcome` to remove/display:none in JS
Approach: `welcome.style.display = "none"` or `welcome.remove()` on clear; reverse on reset.
Trade-off: Diverges from the attribute-based pattern used everywhere else; more JS surface and easier to desync with `state.welcomeVisible`. Unnecessary once CSS matches peers.

## Decision
**Chosen: A** (with test that proves post-send invisibility). Optionally document that B remains a one-task product follow-up if the human wants About gone on empty canvas too.

Rationale against constraints: Intent is post-submit visibility; root cause is documented author-style vs `[hidden]` (survey: `chat.css:265-272` vs missing override; peers at `109-111`). A is the same fix already applied to popovers, cards, and labels. Non-goals exclude About panel redesign and broader welcome redesign.

What the rejected options were better at:
- **B** is better if the product goal is “less chrome on empty tabs,” not “hide after send.”
- **C** is better only if CSS cascade could not be trusted (it can — same webview as every other override).

## Shape of the change
1. **CSS** (`media/chat.css`): Add `.welcome[hidden] { display: none; }` adjacent to other `[hidden]` overrides or near `.welcome` rules, with a one-line comment mirroring the popover note (`display:flex` beats UA `[hidden]`).
2. **No production JS change required** for hide path: `clearWelcome` already sets `hidden` (`media/chat.js:2462`).
3. **Tests:**
   - Extend a DOM test (prefer `test/welcome-canvas.dom.test.ts` or a focused case in session-setup / new small case) so that after a first `userMessage` / send path that calls `clearWelcome`/`openTurn`, `#welcome` has `hidden` **and** is not displayed (assert `getComputedStyle(welcome).display === "none"` **or** assert About link / welcome heading not visible via the same computed style if happy-dom supports it).
   - If happy-dom does not apply the cascade reliably, add a **source-level** regression test that `chat.css` contains `.welcome[hidden]` (same style as `welcome-canvas.dom.test.ts:51-56` CSS source checks) **and** keep a DOM test that first send sets `welcome.hidden === true` and that About is under `#welcome` so fixing CSS is load-bearing.
4. **Markup:** Keep About on empty canvas (LEAVE) unless gate chooses B.

## Disposition of superseded code
Every item from the survey's supersession section. No item may be omitted.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Broken reliance on UA `[hidden]` alone for `#welcome` | REPLACE | Explicit `.welcome[hidden]` becomes the authoritative hide rule | Add CSS + prove post-send hide in tests |
| About link product surface on empty welcome | LEAVE | Out of scope unless human opts into product removal; gear About remains the always-available path | Do not delete markup in the default plan |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| First send | `clearWelcome` → `hidden` + CSS → no About, no title |
| New session / reset | `resetForNewSession` clears `hidden` → welcome flex layout returns |
| Onboarding | `showOnboarding` shows welcome; onboarding card still mounts |
| Primer-only restore | Welcome stays up when history is primer-only (existing logic); CSS only hides when `hidden` is set |
| Concurrent edit | N/A (local UI) |
| Permission denied | N/A |

## Migration
Schema change: no  
Reversible: yes (delete the CSS rule)  
Existing rows: N/A  
Mixed-version window: N/A  

## New dependencies
None.
