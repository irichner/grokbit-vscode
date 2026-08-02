# Plan — Vibe-coder Wave 1 (trust + mid-turn flow)

Slug: `vibe-coder-wave-1` · Approach: Content digest on allow-once Write grants + queue-visible mid-turn + steer via pendingSteer · Blast radius: ~10–14 files, 0 new deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

`cwd:` is optional — omit or write `none` for a single-package repo.

## Tasks

### T1 — Content digest on path grants (pure)
- **intent:** Optional `contentDigest` on non-durable path grants when `rawInput.content` present; `consumeWriteGrant` blocks path-matched writes whose body hash diverges; durable grants stay path-only.
- **files:** `src/permission-bind.ts`, `test/permission-bind.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/permission-bind.test.ts`
- **removes:** none
- **baseline:** path-only extract/consume (`src/permission-bind.ts`); existing tests in `test/permission-bind.test.ts`
- **rollback:** `git revert` / restore two files
- **state-after:** working
- **notes:** Add `BIND_BLOCKED_CONTENT_MSG`, `hashGrantContent`. Cases: content match allow+consume; mismatch block; no content → path-only; allow_always no digest; empty grants allow; Windows path normalize unchanged. Do not import vscode.

### T2 — Enforce content bind at fs/write choke point
- **intent:** Pass write body into `consumeWriteGrant`; surface content mismatch via existing `mutationBlocked` / bind error path.
- **files:** `src/acp.ts`, `test/acp-integration.test.ts` (or extend permission-bind-only if integration cannot express body — prefer at least one integration case)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/permission-bind.test.ts test/acp-integration.test.ts`
- **removes:** none
- **baseline:** `consumeWriteGrant(params.path, …)` only at `src/acp.ts:648`
- **rollback:** `git revert`
- **state-after:** working
- **notes:** `params.content` already available at `acp.ts:655`. Prefer allow_once grant + mismatched body → mutationBlocked kind bind.

### T3 — Immediate queued user bubble + dequeue on drain
- **intent:** Mid-turn queue shows a queued user bubble immediately; drain clears the badge without a second bubble; preserve chips/images snapshot.
- **files:** `src/session.ts` (queueId on pending entry if needed), `src/sidebar.ts` (`queueFollowUpSend`, `executeUserSend`), `media/chat.js`, `media/chat.css`, `test/*.dom.test.ts` (new or extend existing send/queue DOM test)
- **cwd:** none
- **depends:** none (can parallel T1)
- **verify:** `npm test -- test/paste-image.dom.test.ts` (if mid-turn image queue covered) and any new DOM test file for queued badge; plus a host-facing unit if pure helper extracted
- **removes:** none (behavior replace of silent deferred-only ack)
- **baseline:** deferred UI ack only (`sidebar.ts:4419-4434`); no queued badge
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Design frozen: emit `userMessage`+`queued:true`+`queueId` at queue; `userMessageDequeued` at drain; no second `userMessage`. Theme tokens; no `@media`.

### T4 — Steer (cancel + send) via pendingSteer
- **intent:** Explicit steer posts cancel current turn, clear queue, then send the new message once the lane is free; Stop still does not send; default Enter still queues.
- **files:** `src/session.ts` (`pendingSteer`), `src/sidebar.ts` (`handleSend`, cancel path), `media/chat.js` (shortcut table + tooltips), tests (DOM for message shape + pure/host unit for pendingSteer if extractable)
- **cwd:** none
- **depends:** T3 (queue clear must remove visible queued bubbles)
- **verify:** `npm test --` tests added/updated for steer + T3 suite; keyboard shortcut branches for `useCtrlEnter` true/false
- **removes:** none
- **baseline:** mid-turn always queues (`sidebar.ts:4437-4440`); Ctrl+Enter is send when `useCtrlEnter` (`chat.js:6454-6455`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Shortcut: `!useCtrlEnter` → Ctrl/Cmd+Enter steers; `useCtrlEnter` → Ctrl/Cmd+Shift+Enter steers. `pendingSteer` mandatory (no busy-wait). Clear pendingSteer on Stop.

### T5 — Docs known-limits honesty
- **intent:** CLAUDE.md Known limits: content bind covers allow-once Write with `content`; allow_always / Edit-only remain path-scoped; note mid-turn queue badge + steer shortcuts.
- **files:** `CLAUDE.md` (Known limits / ACP surfaces as needed), optionally one line in `CHANGELOG.md` only if user is about to rebuild (else skip changelog until rebuild)
- **cwd:** none
- **depends:** T2, T4
- **verify:** manual read of known-limits bullet no longer claims “same-path content bait-and-switch is not covered” without the allow-once/Write nuance; `npm test` still green
- **removes:** stale absolute “not covered” wording for content switch
- **baseline:** `CLAUDE.md` Known limits permission-bind bullet
- **rollback:** restore prose
- **state-after:** working
- **notes:** Do not invent token counts; no VERSION bump (not a commit task).

### T6 — Full suite green
- **intent:** Entire grok-free suite passes after T1–T5.
- **files:** any test fixes required within wave scope
- **cwd:** none
- **depends:** T1–T5
- **verify:** `npm test`
- **removes:** none
- **baseline:** suite green before wave (run at implement start)
- **rollback:** revert feature commits
- **state-after:** working
- **notes:** Floor remains project test count; expect new tests to raise count.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| DC1 Content bind Write mismatch blocked | T1 + T2 verify |
| DC2 Path-only / empty grants still work | T1 tests |
| DC3 Default mid-turn queues | T3 + T4 (Enter still queues) |
| DC4 Queue visible immediately | T3 DOM verify |
| DC5 Steer cancel+send | T4 verify |
| DC6 Stop no send | T4 tests / code path assert clear pendingSteer without execute |
| DC7 Tests green | T1–T4 + T6 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 3 | T1–T2 path-only write bind; T3 silent queue ack; T5 docs LEAVE wording |
| DEPRECATE | 0 | — |
| COEXIST | 1 | T4 — queue default + steer path (permanent dual) |
| LEAVE | 3 | Edit-only path grants; multi-mode palette; paste pipeline |

Net lines: expect +~250 / −~40 (est.). Legitimate additive (feature) + REPLACE of silent ack / path-only digest gap.

## Open assumptions

Pointer to full ledger: `assumptions.md`.

- `UNVERIFIED` steer product acceptability (default queue kept)
- `UNVERIFIED` allow_always stays path-only for content (intentional after R1)
- Residual Edit-only without `content` stays path-bound (LEAVE)

## Approval
- [x] Human approved — 2026-08-02 (user: `/grokbit-implement this plan`)
