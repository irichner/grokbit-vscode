# Design — Vibe-coder Wave 1 (trust + mid-turn flow)

## Options considered

### Option A — Content digest on Write grants + mid-turn steer/queue UX (thin extension)

**Approach:** Extend `PermissionGrant` with optional `contentDigest` (sha256 hex of `rawInput.content` when present). `consumeWriteGrant(path, content, grants)` fails if a matching path grant has a digest and the write body hash differs. Mid-turn: keep Enter = FIFO queue; add steer = cancel + clear queue + send; emit immediate `userMessage` (or dedicated `userMessageQueued`) when queueing so the bubble appears with a queued state until drain.

**Trade-off (against intent):** Fully covers DC1–DC7 with small pure-module + host/webview changes; Edit-only permissions stay path-bound (honest limit). Does not deliver full VS Code three-mode send menu or drag-reorder (non-goals).

### Option B — Full permission ladder + multi-mode send palette

**Approach:** Claude-Code-like modes (Manual / acceptEdits / plan / auto classifier / bypass) plus VS Code-style send split-button (Queue / Steer / Stop-and-Send) with reorderable queue list UI.

**Trade-off:** Much larger UX and product surface; risks diluting Grokbit’s existing Agent / Plan / Auto-accept tri-mode; multi-week blast radius; research explicitly preferred deepening safe auto-apply over inventing a new ladder.

## Decision

**Chosen: A**

Rationale against constraints: ships the two highest residual research gaps without abandoning the safety-net brand; reuses `permission-bind` and existing queue lane; keeps default mid-turn behavior additive (CHANGELOG contract); falsifiable tests stay grok-free.

What the rejected option was better at: Option B would match competitor chrome more literally and give power users a richer permission ladder. Revisit only if Wave 1 still leaves users hunting for “modes” after content-bind + steer ship.

## Shape of the change

### 1. Content bind (pure + acp)

- `PermissionGrant` gains optional `contentDigest?: string` (`src/permission-bind.ts` today has only path/command fields — survey `permission-bind.ts:29-36`).
- `extractGrant`: when path extracted and `rawInput.content` is a non-empty string **and the grant is non-durable** (`allow_once`), set `contentDigest = sha256(utf8(content))`. **Durable (`allow_always`) never stores a digest** (Review R1 BLOCKER — otherwise Auto-accept locks one body forever). No content → path-only grant as today.
- Export `hashGrantContent(content: string): string` for tests (Node `crypto.createHash("sha256")`).
- `consumeWriteGrant(path, content, grants)` signature gains content (string | undefined):
  - No path-scoped grants → allow (unchanged).
  - Path mismatch → block (`BIND_BLOCKED_WRITE_MSG`).
  - Path match + non-durable grant with `contentDigest` + body hash ≠ digest → block with `BIND_BLOCKED_CONTENT_MSG` (new constant).
  - Path match + digest match, or grant has no digest (incl. all durable) → allow; consume non-durable as today.
- `src/acp.ts` write path passes `params.content` into consume (today only path at `acp.ts:648`).
- Auto-approve and user allow both use same `extractGrant` (`sidebar.ts:2609-2614`, `3036-3044`). Note: autoApprove prefers `allow_always` → path-only in practice for YOLO; user **Allow once** gets content bind when `content` present.

### 2. Mid-turn queue visibility

- Extend queue entry with `queueId: string` (uuid or monotonic id).
- On `queueFollowUpSend` (`sidebar.ts:4422-4434`): after push, **emit once**:
  `{ type: "userMessage", text, chips, images?, queued: true, queueId }` (buffered via `emit` so hide/reveal replays).
- On drain in `executeUserSend` when `alreadyAcked`:
  - Emit `{ type: "userMessageDequeued", queueId }` **only** (badge clear).
  - **Do not** emit a second full `userMessage` (Review R1 MAJOR). Title/history bookkeeping still runs.
- Webview: `queued: true` → muted “Queued” badge + `data-queued="true"`; on `userMessageDequeued`, remove badge from matching bubble.
- Composer still clears text/chips/images as today.

### 3. Steer

- **Shortcut table (tracks `useCtrlEnter`):**

  | Setting | Default send / queue | Steer (busy + content) |
  |---|---|---|
  | `useCtrlEnter === false` | Enter / Send click | Ctrl/Cmd+Enter |
  | `useCtrlEnter === true` | Ctrl/Cmd+Enter / Send click | Ctrl/Cmd+Shift+Enter |

- Webview posts `{ type: "send", text, chips, steer: true }` for steer; plain send omits `steer` or `steer: false`.
- Tooltips while stoppable busy reflect the table (no hardcoded Ctrl+Enter only).
- Host: if `promptInFlight && msg.steer`:
  1. Snapshot `session.pendingSteer = { text, chips snapshot, images snapshot }`.
  2. Clear `pendingUserSends` (and post dequeue/remove for any visible queued bubbles if needed — clear-all-queued event ok).
  3. Cancel in-flight prompt + `suppressTurnTail` (same as Stop).
  4. When turn lane releases (`handleSend` finally or cancel completion path), if `pendingSteer` set for this gen: run one `executeUserSend` (not alreadyAcked) and clear `pendingSteer`.
- Send-button long-press / split UI **out of scope**.

### 4. Stop

- Unchanged: cancel + clear queue + clear `pendingSteer`, no new send (`chat.js:5422-5428`).

## Disposition of superseded code

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Path-only write bind | REPLACE | Content digest optional on same grant type | Migrate `consumeWriteGrant` signature + all call sites (1 in acp) + tests |
| Phase A content-hash LEAVE | REPLACE | Product now prioritizes Write bait-and-switch close | Update CLAUDE.md known-limits bullet; phase-a docs can stay historical |
| Silent deferred queue ack | REPLACE | DC4 requires visible queue | queueFollowUpSend emits immediate userMessage; drain activates |
| Enter-only mid-turn (no steer) | COEXIST | Default Enter stays queue; steer is additive path | Document shortcut; both paths kept permanently for different intents |
| Edit-only path grants (no content) | LEAVE | No full body at approve time without racy read | Document residual limit |
| Full multi-mode send palette | LEAVE | Non-goal | — |
| Paste-screenshots pipeline | LEAVE | Already in tree; not this wave | — |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| Content mismatch on write | `respondError` bind code + `mutationBlocked` kind `bind`; write not applied |
| Grant with path only | Path match allows any content (documented residual) |
| Empty grants | Allow writes (Agent mode) |
| Steer while priming/locked busy | Ignore steer or treat as no-op until stoppable busy (same as Stop) |
| Steer with empty content | No-op |
| Queue while stop arrives | Queue cleared; no drain |
| Concurrent steer + queue race | Steer wins: queue cleared before cancel |
| Hash of huge content | ACP content already in memory; sha256 of string is fine; no extra disk |

## Migration

Schema change: no.  
Reversible: yes (feature flag not required; pure grant field optional).  
Existing sessions: grants in memory only; no disk migration.  
Mixed-version: N/A.

## New dependencies

None. Use Node `crypto.createHash` inside pure module (already Node extension host); tests run in Node/vitest.

## UI/UX (hard gate 8)

### Design reference

- User bubble: existing `.msg.user`; add small muted badge `.msg-queued-badge` “Queued” using `--vscode-descriptionForeground`.
- Composer placeholder or send tooltip while `state.busy && !busyLocked`: “Enter to queue · Ctrl+Enter to stop & send”.
- Tokens only; no new `@media`.

### State inventory

| State | Behavior |
|---|---|
| Idle send | Unchanged |
| Busy + Enter + content | Queue + immediate queued bubble |
| Busy + Ctrl/Cmd+Enter + content | Steer |
| Busy + empty Enter | No-op |
| Busy + Stop | Cancel + clear queue |
| Queued bubble | Muted badge; not editable |
| Dequeued / running | Badge removed; normal user turn |
| Content bind block | Existing mutation-block notice path |

### A11y

- Badge text not color-only.
- Keyboard: Ctrl/Cmd+Enter documented; focus remains in composer.
- Tooltip on send button while stoppable busy.

### Falsifiable design criteria

1. After mid-turn Enter, a `.msg.user` with “Queued” (or `data-queued="true"`) appears before the agent turn ends.
2. After drain, that bubble is no longer marked queued (single bubble, not two).
3. No new `@media` rules in `chat.css`.
