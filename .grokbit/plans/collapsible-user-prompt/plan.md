# Plan — Collapsible long user prompts

Slug: `collapsible-user-prompt` · Approach: Option A — revive `makeCollapsible`, one-line clamp, pure should-collapse + live/replay wire · Blast radius: ~3–4 files (chat.js, chat.css, webview-helpers optional, DOM tests), 0 deps, no schema

## Tasks

### T1 — Pure collapse criterion + unit tests
- **intent:** Define a deterministic `userPromptShouldCollapse(text)` so multi-line/long prompts collapse without relying on flaky happy-dom layout measurement alone.
- **files:** `media/webview-helpers.js`, `test/webview-helpers.test.ts` (or new small test file if preferred)
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/webview-helpers.test.ts`
- **removes:** none
- **baseline:** none (new pure helper; no behavior change until T2)
- **rollback:** `git revert` the commit for this task
- **state-after:** working
- **notes:** Rule from design: `true` if trimmed text contains `\n` **or** trimmed length > constant (e.g. `USER_PROMPT_COLLAPSE_MIN_CHARS = 120`). Export constant + function. Measurement may later **only add** cases.

### T2 — Wire collapse on live + replay user bubbles
- **intent:** Long user prompts get `.collapsible` + Show more/less; short ones do not; live `userMessage` and replay `appendUserChunk` both work; no stacked buttons on re-apply.
- **files:** `media/chat.js`, `test/user-prompt-collapse.dom.test.ts` (new)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/user-prompt-collapse.dom.test.ts`
- **removes:** none (removes dead skip policy in comment only)
- **baseline:** Full multi-line user body always visible in active turn (`addMessage` returns body; no `makeCollapsible` call — `media/chat.js:3418-3420`). Capture: multi-line `userMessage` has no `.collapsible` / no `.msg-expand-btn`.
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Evolve `makeCollapsible` for idempotency; call after live body set; re-call after replay body updates (`appendUserChunk` `media/chat.js:4598`). Optional: layout measurement enhancement only if pure says false but body overflows. Do not break turn `openTurn` / single bubble DC from turn-containers.

### T3 — CSS one-line clamp + always-visible expand
- **intent:** Collapsed body shows ~one line; expand control visible without hover; drop obsolete 48px / hover-only rules; theme-token buttons remain.
- **files:** `media/chat.css`, `test/user-prompt-collapse.dom.test.ts` (CSS contract asserts)
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/user-prompt-collapse.dom.test.ts test/chat-turn-containers.dom.test.ts`
- **removes:** `.msg.user.collapsible .body` `max-height: 48px` behavior; hover-only expand rule as sole discoverability path; optional gradient `::after` if dropped per design
- **baseline:** CSS block `media/chat.css:2967-3021` as survey cited
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Use `-webkit-line-clamp: 1` / `line-clamp: 1` without `@media`. Prefer flow layout for expand under body if absolute collides with actions.

### T4 — Turn-container regression + full suite
- **intent:** Prior-turn accordion and sticky active prompt still work; full suite green.
- **files:** (tests only if adjustments needed) `test/chat-turn-containers.dom.test.ts`, possibly other `*.dom.test.ts`
- **cwd:** none
- **depends:** T3
- **verify:** `npm test`
- **removes:** none
- **baseline:** Full suite green before change (record count in implement notes)
- **rollback:** `git revert` feature range
- **state-after:** working
- **notes:** DC7 + DC8. Expand/collapse in-bubble must not prevent turn header collapse.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 Long prompt one-line default | T2/T3 tests + CSS contract |
| DC2 Expand without hover | T3 CSS + DOM assert expand visible/present |
| DC3 Expand full text | T2 click expand |
| DC4 Collapse back | T2 click collapse |
| DC5 Short unchanged | T1 pure false + T2 short message no chrome |
| DC6 Replay parity | T2 replay/`user_message_chunk` path test |
| DC7 Turn collapse | T4 + `chat-turn-containers` |
| DC8 Regression floor | T4 `npm test` |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T2 (skip policy), T3 (48px clamp, hover-only expand / gradient) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | turn accordion is LEAVE (different surface), not dual same-surface |
| LEAVE | 1 | turn-header collapse — no task |

Net lines: small positive (wire + tests); CSS roughly net-neutral (replace rules).

## Open assumptions

See `assumptions.md`. Human may tune char threshold at gate.

## Approval
- [x] Human approved — 2026-08-02 (via `/grokbit-implement this plan`)
