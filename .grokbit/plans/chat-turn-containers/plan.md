# Plan — Chat turn containers & clean final answers

Slug: `chat-turn-containers` · Approach: Option A turn-container DOM (sticky active prompt, ephemeral activity, collapsible prior turns) · Blast radius: ~6–10 files (webview + tests + light CSS), 0 new deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Turn shell: open / collapse / sticky prompt container
- **intent:** Each user send creates a `.turn` container with a prompt header; the active turn’s prompt stays sticky at the top of `.messages`; sending again collapses the previous turn to a one-line expandable header.
- **files:** `media/chat.js`, `media/chat.css`, `test/chat-turn-containers.dom.test.ts` (new)
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/chat-turn-containers.dom.test.ts`
- **removes:** none
- **baseline:** Flat transcript append of user bubbles under `#messages`; long prompts use `makeCollapsible` only (`media/chat.js:2649-2696`). Capture: two user messages produce two free-scrolling `.msg.user` nodes with no `.turn` wrapper.
- **rollback:** `git revert` the commit for this task
- **state-after:** working
- **notes:** Survey: no turn entity today (`02-survey.md`). Sticky only on `.turn.active .turn-prompt`. Collapse UI: chevron + truncated prompt; expand reveals prompt body + answer slot (answer may be empty until T3). Wire `userMessage` and replay `appendUserChunk` bubble creation. Skip wrapping primer-suppressed turns. Prefer truncating turn-header text over competing with `makeCollapsible` on the same surface (Review Round 1 #6).

### T2 — Live activity under active turn (carousel stays single-line)
- **intent:** While a turn is working, all intermediate agent activity (tools, thinking, folded narration) renders under that turn’s `.turn-activity` as the existing single-line carousel (when `compactActivity`) or classic list (when off) — never as free-floating rows above/below other turns.
- **files:** `media/chat.js`, `test/chat-turn-containers.dom.test.ts`, possibly `test/activity-carousel.dom.test.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/chat-turn-containers.dom.test.ts test/activity-carousel.dom.test.ts`
- **removes:** none
- **baseline:** `ensureActivityBlock` appends to `messagesEl` (`media/chat.js:2965`); carousel live strip behavior in `test/activity-carousel.dom.test.ts:22-38`.
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Reuse `ensureActivityBlock` / `activityStep` / helpers; only change parent node to active turn’s activity region. Interactive cards still segment-break live strip but parent under active turn (DC8).

### T3 — Seal turn: destroy intermediate, keep final answer only
- **intent:** On turn completion (`commitAgentTurn` / `promptComplete`), remove intermediate activity (and resolved permission/question chrome); keep user prompt + final answer (and unresolved cards if any). Provisional agent text lives in answer slot unless folded into activity as narration.
- **files:** `media/chat.js`, `test/chat-turn-containers.dom.test.ts`, `test/activity-carousel.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/chat-turn-containers.dom.test.ts test/activity-carousel.dom.test.ts`
- **removes:** Permanent `.activity-carousel.done` freeze behavior and single-item unwrap-to-transcript tool rows after seal (behavior remove, not necessarily whole functions)
- **baseline:** `finalizeActivity` freezes multi-batch to summary (`media/chat.js:3011-3043`; `test/activity-carousel.dom.test.ts:107-128`); single-batch unwrap leaves tool-group (`:131-140`); late toolCallUpdate still attaches (`:154-175`).
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Implement `ensureTurnAnswerEl`; clear `toolItemsByToolCallId` entries destroyed with activity; late updates after seal no-op (replace old late-attach tests). Resolved cards stripped on seal; unresolved cards kept (Review amendment #2).

### T4 — Collapse stack + multi-turn expand/collapse UX polish
- **intent:** Completed prior turns show as collapsed headers; user can expand/collapse each to show/hide that turn’s final answer; three-turn session is navigable without permanent tool walls.
- **files:** `media/chat.js`, `media/chat.css`, `test/chat-turn-containers.dom.test.ts`
- **cwd:** none
- **depends:** T3
- **verify:** `npm test -- test/chat-turn-containers.dom.test.ts`
- **removes:** none
- **baseline:** Full history remains expanded in scroll order; no turn accordion.
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Keyboard/accessibility: header button with `aria-expanded`. Active turn not collapsed until next send. Expand of prior does not require sticky.

### T5 — Replay / restore parity + card/test suite migration
- **intent:** Buffer replay and session restore build the same turn containers; permission/plan/question/tool-summary DOM tests updated for nesting; full suite green.
- **files:** `media/chat.js`, `test/activity-carousel.dom.test.ts`, `test/tool-summary.dom.test.ts`, `test/card-collapse-tasks.dom.test.ts`, `test/permission-card.dom.test.ts`, `test/plan-card.dom.test.ts`, `test/question-card.dom.test.ts`, other broken `*.dom.test.ts` as needed
- **cwd:** none
- **depends:** T4
- **verify:** `npm test`
- **removes:** Obsolete assertions requiring permanent `.activity-carousel.done` or unwrapped post-seal tool rows
- **baseline:** Full `npm test` green on main before changes; primer-only restore (`test/primer-only-restore.dom.test.ts`); card ordering tests.
- **rollback:** `git revert` range for feature
- **state-after:** working
- **notes:** Primer-suppressed turns must not create user-visible turn headers. `clearWelcome` / `resetForNewSession` must clear turn state.

### T6 — Remove freeze-summary contract (replacement cleanup)
- **intent:** Delete or narrow dead code paths that only served permanent done-summaries if fully unused after T3; ensure no remaining “freeze to done” product path on the default turn model.
- **files:** `media/chat.js`, tests touching `finalizeActivity` done state
- **cwd:** none
- **depends:** T5
- **verify:** `npm test` AND confirm no test requires `.activity-carousel.done` after `promptComplete` for the default path (search test sources)
- **removes:** Freeze-to-`.done` summary UX contract; any dead helpers only used for that contract
- **baseline:** Same as T3 baseline (already replaced in T3); this task is the cleanup pass
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Disposition REPLACE for finalize freeze (`03-design.md`). If `finalizeActivity` remains as “destroy activity” rename carefully to avoid drive-by refactors beyond scope — prefer behavior change in place if rename churn is high.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 Prompt container at top / sticky while active | T1 verify (DOM: `.turn.active .turn-prompt` present; sticky style or layout assertion) |
| DC2 Live single-line activity under prompt | T2 verify (carousel under `.turn-activity`, one strip) |
| DC3 Intermediate work disappears | T3 verify (no permanent tool/activity rows after seal) |
| DC4 Final surface = prompt + answer | T3 verify |
| DC5 Prior turn collapses on next send | T1 + T4 verify |
| DC6 Multi-turn stack | T4 verify (3 turns) |
| DC7 Resume/replay parity | T5 verify (replay dispatch sequence in DOM test) |
| DC8 Interactive cards still work | T5 verify (existing card tests green) |
| DC9 `npm test` green | T5 / T6 verify |

## Disposition summary

Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 4 | T3 + T6 (freeze summary, unwrap tool rows, flat-only model for turns, obsolete tests) |
| DEPRECATE | 0 | — |
| COEXIST | 1 | classic `compactActivity` live presentation only (T2 notes); seal still destroys intermediate |
| LEAVE | 2 | `makeCollapsible` for long prompt text; `activityPeek` helpers reused |

Net lines: expect roughly +400 / −200 in webview+tests (estimate). Not purely additive — REPLACE tasks remove freeze-summary behavior.

## Open assumptions

Pointer to `assumptions.md`:

- Expand prior = prompt + answer only (no activity log)
- Active-only sticky
- Unresolved cards survive seal; resolved cards stripped
- Deliverable media/doc cards count as answer surface
- Sticky+zoom visual beyond happy-dom may be `UNVERIFIED` without manual check

## Approval

- [x] Human approved — 2026-08-01
