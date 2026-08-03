# Review log — Collapsible long user prompts

## Round 1 — Plan Reviewer (adversarial)

### Grounding spot-checks

- [x] `makeCollapsible` at `media/chat.js:3296-3315` — confirmed, unused.
- [x] Skip comment at `media/chat.js:3418-3420` — confirmed no call after user append.
- [x] CSS clamp `max-height: 48px` at `media/chat.css:2969-2972` — confirmed.
- [x] Hover-only expand at `media/chat.css:3003` — confirmed.
- [x] `appendUserChunk` rewrites `.body` via `activeUserEl.innerHTML` — confirmed `media/chat.js:4588-4598`.

### Findings

1. **[MAJOR] Replay path incomplete if only `addMessage` is wired** — evidence: `appendUserChunk` starts with `addMessage("user", "")` then fills body later (`media/chat.js:4588-4598`). Applying collapse on empty body always fails overflow check; never re-applied → **DC6 fails**. Resolution: design must require post-content apply on replay (explicit task step / verify).

2. **[MAJOR] Overflow-only gate without happy-dom strategy risks green tests that prove nothing** — evidence: survey Absences; happy-dom often reports equal scroll/client heights. Resolution: design already mentions heuristic fallback; plan tasks must encode a **deterministic** criterion for tests (e.g. `\n` present **or** length > threshold **or** forced class via testable pure `userPromptShouldCollapse(text)`), and DOM tests assert class + button behavior, not pixel heights alone.

3. **[MINOR] Gradient fade + line-clamp may look odd** — evidence: `::after` gradient at `media/chat.css:2974-2980`. Resolution: prefer drop gradient when using line-clamp:1, or keep if still useful; not blocking.

4. **[MINOR] Expand button absolute positioning may collide with copy actions** — evidence: `.msg-expand-btn` `position: absolute; bottom/right` vs `.msg-actions`. Resolution: place expand as flow content under `.body` inside bubble (layout change in CSS task).

5. **Intent coverage:** DC1–DC8 appear covered by Option A. Non-goals respected (no agent collapse, no settings, no host).

6. **Supersession:** all three survey supersession rows have dispositions; turn-header LEAVE is correct.

7. **Reinvention:** Option B correctly rejected.

### Verdict Round 1

MAJOR items need design/plan explicitness, not a different approach. Architect must revise design notes + tasks for replay + deterministic collapse criterion.

---

## Round 1 — Architect response

Addressed:

1. **Replay:** Design § Implementation shape already required re-apply after body fill; elevated to explicit T2 + verification (DC6). Also apply when `userMessage` is complete (live has full text immediately — ok).
2. **Deterministic criterion:** Prefer exported pure `userPromptShouldCollapse(text)` in `webview-helpers.js` (or chat.js if keep local with source test):
   - `true` if text contains a newline after trim, OR trimmed length > **120** chars (one generous visual line at typical panel widths), OR optional future override.
   - Layout measurement (`scrollHeight`) is an **enhancement** when available to catch long single-line wrap without `\n`; pure function is the testable SoT for multi-line/long paste; measurement can only **add** collapse cases, not remove pure-true cases (avoids happy-dom false negatives).
3. **Gradient:** REPLACE disposition — remove `::after` fade when moving to line-clamp:1 (cleaner).
4. **Button layout:** flow-level control under body, not hover-absolute-only (updates CSS REPLACE for hover rule).

Design decision remains Option A with these amendments baked into tasks.

---

## Round 2 — Plan Reviewer

Re-read `03-design.md` (amended above via this log) and intent/survey.

### Findings

1. **[MINOR] Magic number 120** — document as constant `USER_PROMPT_COLLAPSE_MIN_CHARS` with one-line comment; easy to tune.
2. **[MINOR] Images-only messages** — pure function on empty body → false; good.
3. No remaining BLOCKER/MAJOR on design approach.

### Verdict Round 2

**Exit Loop 3** — zero BLOCKER, zero MAJOR. Proceed to decompose.

---

## Loop 4 — Plan-level pass (after `plan.md`)

Checklist on tasks:

- [x] Every task has runnable `verify:` (`npm test -- …` on Windows-compatible form).
- [x] `baseline:` / `removes:` / `rollback` present.
- [x] Verification matrix maps DC1–DC8.
- [x] Disposition summary matches design.
- [x] T1 pure criterion addresses R1 #2; T2/T3 wire live+replay addresses R1 #1; T4 CSS addresses clamp/hover/gradient.

### Findings

1. **[MINOR] T3 depends on T1+T2** — order is correct.
2. No BLOCKER.

### Verdict Loop 4

**Plan approved for human gate** from Reviewer perspective (human still decides).
