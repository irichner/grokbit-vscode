# Intent — Vibe-coder Wave 1 (trust + mid-turn flow)

## Problem

Vibe coders need a fast natural-language loop (say intent → apply → see result → refine) without surprise writes and without losing control mid-turn. Research on improving Grokbit for this audience found the product already owns a strong middle path (Plan first, permission cards, in-chat diffs, optional Auto-accept) but two residual gaps still break flow and trust:

1. **Trust under Auto-accept / Allow:** approvals are path/command-scoped only; a later write to the *same* path can still apply different content than the user previewed (known v1 limit; content-hash binding was deliberately deferred in Phase A).
2. **Mid-turn control:** follow-ups already queue FIFO without cancelling the live turn, but there is no **steer** (stop current work and send the new message now) and no clear **queue visibility** (composer clears with no immediate “queued” feedback), so the loop feels opaque compared to Cursor / VS Code Chat.

This wave closes those two gaps without abandoning the safety-net brand or inventing blind Accept-All.

## Done criteria

Each item must be checkable by a human performing an observable action.

- [ ] **DC1 — Content bind (Write):** With at least one path-scoped grant that carried preview `content`, a subsequent `fs/write_text_file` to that path with **different** body is **refused** with a clear bind error (not a silent apply). Same path + **same** body still applies.
- [ ] **DC2 — Path-only still works:** Approving an edit/permission that has a path but **no** extractable full `content` still path-binds as today (no false “content required” block). Empty grant list still allows Agent-mode writes.
- [ ] **DC3 — Queue (default mid-turn):** While a turn is running, Enter / Send with content **queues** the follow-up (does not cancel the live stream). After the live turn finishes, the queued message runs and appears as a normal user turn.
- [ ] **DC4 — Queue visible:** When a follow-up is queued, the user immediately sees a **queued** user bubble (or equivalent status chip) for that text/images — not a silent empty composer with no feedback until drain.
- [ ] **DC5 — Steer:** While a turn is running, an explicit **Steer** action (modifier Send, e.g. Ctrl/Cmd+Enter, and/or a documented secondary control) **cancels** the in-flight turn, clears abandoned queue entries as Stop does today, then **sends** the new message as the next turn.
- [ ] **DC6 — Stop unchanged:** Stop still cancels the live turn and clears the queue **without** sending a new message.
- [ ] **DC7 — Tests:** Pure unit tests cover content-hash grant extract/match/mismatch; DOM or unit tests cover queue ack UI and steer message shape; full `npm test` green (grok-free).

## Non-goals

- Making Grok advertise or accept vision image blocks (`promptCapabilities.image` stays agent-driven).
- Nested subagent inspector, MCP browser, Business Studio stretch (media gallery, React Flow).
- Default product stance of unreviewed Accept-All / bypassPermissions.
- Full VS Code multi-mode send menu (Queue / Steer / Stop-and-Send as three always-visible modes with drag-reorder).
- Content reconstruction for Edit tools that only supply `old_string`/`new_string` without full `content` (path-only remains for those).
- Launcher incremental-render rewrite, worktree UI, electron suite, new dependencies.
- Marketplace release / version bump (user-initiated rebuild).
- Replacing or re-implementing paste-screenshots (already in the working tree).

## Constraints

- Stack / version limits: VS Code extension, pure policy modules testable without spawning real `grok`/`claude`; `npm test` stays grok-free.
- Must not break: existing path/command permission-bind; additive mid-turn queue as the **default** Enter/Send behavior; Plan gate; dual-backend quirks.
- Sequencing: research priorities from deep-research; Phase A explicitly LEAVE’d content-hash — this wave **replaces** that non-goal for Write-shaped payloads only.
- UI: theme tokens only; no new `@media` in `chat.css`; UI design standards apply when touch webview.

## Assumptions

- `UNVERIFIED` — Mid-turn steer via cancel-then-send is acceptable product behavior for vibe users (matches Cursor-style Cmd+Enter redirect); default remains additive queue.
- `UNVERIFIED` — Hashing `rawInput.content` when present is sufficient for the highest-risk Write bait-and-switch; Edit-only payloads stay path-bound without a full-file digest.
- `UNVERIFIED` — `crypto.createHash("sha256")` (Node) is fine for host-side grant digests; pure tests can inject a hash function or use Node crypto in unit tests the same way other pure modules use `node:path`.
- Decided: Wave scope is **trust content-bind + mid-turn steer/queue UX only**, not the entire research roadmap.

## Questions asked

None this batch — scope inferred from deep-research priorities + existing Phase A LEAVE of content-hash + shipped mid-turn queue (CHANGELOG / `session.pendingUserSends`). Different answers would have been needed only if the user wanted a multi-phase roadmap doc instead of a shippable wave; they asked to write **and implement** a plan.
