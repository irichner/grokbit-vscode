# Intent — Switch Agents on any tab and retain context

## Problem
Users can change **Agent** (Grok ↔ Claude) from Session Setup, the model/quick-settings popover, or the backend chip. On a tab with real conversation history—including a session reopened from history—the host warns that history cannot carry over and starts a **fresh** session on the other agent. That forces a dead-end: either abandon the switch or lose the thread. Users want to flip agents mid-work (or after reopening a past chat) and keep the conversation available so the new agent can continue the same task.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] On a tab **with history** (live conversation or resumed from history/launcher), the user can switch Agent (Grok ↔ Claude) without being forced into a “start fresh / lose history” dead-end.
- [ ] After that switch settles, the **visible chat transcript remains** in the tab (user and agent turns from before the switch are still scrollable/readable; hide+reveal does not wipe them).
- [ ] After that switch, the **new agent has prior-conversation context** for the next user message (observable: asking “what were we just working on?” / continuing a named task works without re-pasting the whole thread).
- [ ] Empty / primer-only tabs still switch transparently (no destructive confirm; no orphan empty sessions piled up—same spirit as today’s empty-flip discard).
- [ ] The **original backend’s on-disk session is not deleted** when switching a tab that had real history (reopenable later from history under the original agent badge).
- [ ] A short, honest in-tab affordance indicates that the agent changed and prior context was applied (not a silent restart).
- [ ] Automated coverage: pure unit tests for transcript/handoff extraction + size policy; host/webview behavior covered where the suite can (DOM/message contracts); full `npm test` green.
- [ ] Docs that currently claim “history can’t carry over between backends” are updated so they match shipped behavior.

## Non-goals
- True shared ACP session identity across backends (`session/load` of a Grok id into Claude or the reverse). Different on-disk stores and agents make that impossible in this architecture.
- Bit-perfect replay of every tool call, permission card, and plan card as live ACP state on the new agent (those remain UI history; the new process only receives text handoff).
- Unifying Grok and Claude model lists, plan-mode quirks, or session stores.
- Auto-switching agents without user action.
- Changing history list merge/pagination, rename/delete, or launcher windowing except as needed for correctness after a flip.
- Making Summarize & Restart for **model/effort** (same backend) identical to Agent switch (out of scope unless a shared helper is the cleanest reuse).

## Constraints
- Stack: VS Code extension host (`src/sidebar.ts`, `src/session.ts`, pure helpers) + webview (`media/chat.js`); grok-free vitest; no new runtime dependencies.
- Must not break: empty-session recycle, primer path, `retainContextWhenHidden:false` replay, per-backend resume (`openTabForId`/`restorePanel`), plan gate quirks, capability re-request on backend flip (`actions-survive-agent-switch` contract).
- Context windows are finite: handoff text must be **bounded** (cap + optional summarize/truncate fallback) so a long thread cannot OOM or hang spawn.
- Sequencing: pure extract/truncate first, then host switch path, then UI banner/docs/tests.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “Full context” means **(1) keep the visible transcript in the tab** and **(2) seed the new agent with as much prior user/assistant text as fits a safe budget**, not a true shared session id across CLIs.
- `UNVERIFIED` A one-shot confirm is still acceptable if it is no longer “you will lose history,” but a light “switch and carry context” confirm is optional; default plan is **carry context without a scary lose-history modal** (still block while priming/busy if needed).
- `UNVERIFIED` Prefer a **deterministic transcript extract from the host buffer** over only the existing one-paragraph summarize path; use summarize (or head/tail truncate) only when the extract exceeds the budget.
- `UNVERIFIED` After switch, the tab’s live `activeSessionId` becomes a **new** session on the target backend; the prior id stays on the source backend’s disk.

## Questions asked
None in-loop. Product forks above are recorded as assumptions and will be confirmed or overridden at the approval gate (see `assumptions.md`).
