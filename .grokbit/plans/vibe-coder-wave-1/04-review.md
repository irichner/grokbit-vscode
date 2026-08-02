# Review log — Vibe-coder Wave 1

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[BLOCKER]` **allow_always + contentDigest locks forever** — evidence: autoApprove prefers `allow_always` (`sidebar.ts:2610-2613`); durable grants are not consumed (`permission-bind.ts:160`). Storing digest on durable grants would block every later different write to that path after the first preview. — resolves by: **never store `contentDigest` on durable grants**; digest only on `allow_once` (non-durable). Document that Auto-accept/allow_always remains path-scoped for content (honest residual for “always allow this path”).
- `[MAJOR]` **Double user bubble on queue drain** — evidence: design emits `userMessage` at queue time AND `executeUserSend` already emits user bubble when `alreadyAcked` (survey `sidebar.ts:4471-4475`). — resolves by: frozen contract: queue path emits once with `queued:true`; drain emits only `userMessageDequeued` / badge-clear, **not** a second `userMessage`.
- `[MAJOR]` **Ctrl+Enter conflicts with `useCtrlEnter`** — evidence: `media/chat.js:6454-6455` already maps Ctrl/Cmd+Enter to **send** when `useCtrlEnter` is true. — resolves by: steer shortcut is Ctrl/Cmd+Enter **only when** `!useCtrlEnter`; when `useCtrlEnter`, steer is Ctrl/Cmd+Shift+Enter (or Alt+Enter). Tooltips must track the setting.
- `[MAJOR]` **Steer cancel race underspecified** — evidence: design “wait for promptInFlight false” without a single state machine. — resolves by: adopt `session.pendingSteer: { text, chips, images } | undefined` filled on steer; cancel clears queue + sets suppressTurnTail + client.cancel; when turn lane releases (`handleSend` finally / cancel complete), if `pendingSteer` set, run `executeUserSend` once and clear it. No busy-wait loop.
- `[MINOR]` Mutation block copy for content mismatch reuses generic bind string (`chat.js:6070-6071`) — optional distinct message; not blocking if target path is shown.
- `[MINOR]` Survey shortcut on autoApprove grant path — confirmed in R1 via grep: `sidebar.ts:2609-2614` uses same `extractGrant`.

### Architect response — Round 1
- `[BLOCKER]` allow_always + digest → **REVISED**: digest only on non-durable path grants; durable never carries contentDigest; consume ignores digest if somehow present on durable.
- `[MAJOR]` double bubble → **REVISED**: single emit at queue; drain = dequeue event only; alreadyAcked executeUserSend skips re-emit when queueId already acked.
- `[MAJOR]` useCtrlEnter conflict → **REVISED**: dual shortcut table in design + UI tooltips.
- `[MAJOR]` steer race → **REVISED**: `pendingSteer` stash pattern mandatory.
- `[MINOR]` message copy → accept generic bind string for v1.

## Round 2
Reviewed: revised `03-design.md` (post-R1)

- `[MAJOR]` none remaining if design file is updated before plan.md.
- `[MINOR]` CLAUDE.md known-limits update should distinguish Write+allow_once content bind from allow_always path-only.

### Architect response — Round 2
- Design patch applied in-place in `03-design.md` (content digest rules, queue emit contract, shortcut table, pendingSteer).
- Docs task will note allow_always residual.

## Outcome
Rounds used: 2 of 3
Outstanding at exit: none (BLOCKER/MAJOR closed)

## Plan review (Loop 4)
Reviewed: `plan.md`

- `[BLOCKER]` none — every task has `verify:`, `baseline:`, `removes:`, `rollback`, `state-after: working`.
- `[MAJOR]` none — Verification matrix maps DC1–DC7; dispositions from design present (REPLACE×3, COEXIST×1, LEAVE×3).
- `[MINOR]` T3 verify names `paste-image.dom.test.ts` optionally — implement should add a dedicated `test/mid-turn-queue.dom.test.ts` if paste file is a weak fit.
- `[MINOR]` T5 changelog optional — fine; rebuild is user-initiated.

### Architect response
- `[MINOR]` dedicated DOM test file preferred — noted in T3 notes as “new or extend”; implement may create `test/mid-turn-queue.dom.test.ts`.

Outcome: clean (no BLOCKER)
