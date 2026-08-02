# Plan — Switch Agents on any tab and retain context

Slug: `agent-switch-retain-context` · Approach: buffer-preserving backend flip + bounded transcript handoff inject · Blast radius: ~4–6 files (new pure module + tests, `sidebar.ts`, optional `chat.js` banner copy, docs), 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

`cwd:` is optional — omit or write `none` for a single-package repo.

## Tasks

### T1 — Pure agent handoff transcript builder + fit
- **intent:** Add a vscode-free module that turns a session UI buffer into a bounded handoff string (coalesced user/assistant text, title-only tools, tail truncate).
- **files:** `src/agent-handoff.ts` (new), `test/agent-handoff.test.ts` (new)
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/agent-handoff.test.ts`
- **removes:** none
- **baseline:** none (new module)
- **rollback:** delete the two new files
- **state-after:** working
- **notes:** Design `03-design.md` pure module + chunk coalesce. Cover: empty buffer, user+assistant chunks, tool title-only, over-budget tail keep, unknown types ignored. Export `AGENT_HANDOFF_MAX_CHARS`.

### T2 — `switchBackend` history path: snapshot, restore, inject, no lose-history modal
- **intent:** Allow Agent switch on tabs with history while keeping visible transcript (buffer + counters) and seeding the new agent with handoff text; empty-tab discard path unchanged.
- **files:** `src/sidebar.ts` (and only if needed a tiny shared inject helper colocated or in `agent-handoff.ts` for envelope string)
- **cwd:** none
- **depends:** T1
- **verify:** `npm test -- test/agent-handoff.test.ts test/backend-chip.dom.test.ts test/session-setup.dom.test.ts test/model-chip.dom.test.ts test/session-setup-chip.dom.test.ts test/capabilities.dom.test.ts` (webview still posts `switchBackend`; no new lose-history string in host source — see notes)
- **removes:** lose-history modal copy in `switchBackend` (`History can't carry over between backends` at `src/sidebar.ts:621-628`)
- **baseline:** On a history tab, Agent switch currently warns and starts a fresh session with no prior agent context and wiped host buffer (`src/sidebar.ts:618-649`, `:2134`)
- **rollback:** `git checkout -- src/sidebar.ts`
- **state-after:** working
- **notes:** Follow `03-design.md` Restore algorithm exactly: snapshot before start; no `resumeId`; restore buffer/`hasHistory`/`userMessageCount`/`latestUserMessageForTitle`; inject after primer with `suppressContent`; await handoff before first send; never `discardAbandonedBackendSession` when `hadHistory`; block `promptInFlight`. Host modal path is not unit-tested in this suite — prove string gone with a focused source assertion in `test/agent-handoff.test.ts` or a small new pure-exported predicate test if logic is extracted; otherwise add `test/switch-backend-handoff.test.ts` that imports pure pieces only. Manual smoke after implement: history flip, hide/reveal, ask “what were we doing?”.

### T3 — Banner / webview copy for agent switch context (if not reusing default)
- **intent:** User sees that the agent changed and prior context was applied (done-criterion affordance).
- **files:** `media/chat.js` and/or `media/chat.css` only if default `sessionContext` banner text is insufficient; prefer parameterizing `sessionContext` message
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/backend-chip.dom.test.ts` (and any new DOM assertion for banner text if added)
- **removes:** none
- **baseline:** Existing “Context from previous session applied” banner (`media/chat.js:3791-3798`) used by model/effort summarize
- **rollback:** `git checkout -- media/chat.js media/chat.css`
- **state-after:** working
- **notes:** Reuse is fine if copy is honest enough; if message becomes “Switched to Claude — prior conversation applied,” cover with a DOM test dispatching `sessionContext`.

### T4 — Docs: retire “history can’t carry over” claims
- **intent:** Product/docs match shipped handoff (text+UI, not shared ACP session).
- **files:** `docs/plans/claude-code-backend.md` (non-goal ~line 44); grep README/CLAUDE/CHANGELOG-facing claims if any
- **cwd:** none
- **depends:** T2
- **verify:** `npm test` (docs-only still keeps suite green); and a search shows no remaining “History can't carry over between backends” in `src/`
- **removes:** obsolete non-goal wording that asserts no cross-backend carry at all
- **baseline:** `docs/plans/claude-code-backend.md:44` documents non-goal
- **rollback:** `git checkout -- docs/plans/claude-code-backend.md` (+ any other doc files touched)
- **state-after:** working
- **notes:** Replacement prose: no shared session id / no `session/load` across stores; extension **does** preserve tab transcript and injects bounded handoff text on Agent switch.

### T5 — Full suite green
- **intent:** No collateral break across session setup, capabilities-on-flip, panel router, sessions.
- **files:** none (verification only)
- **cwd:** none
- **depends:** T1, T2, T3, T4
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** n/a
- **state-after:** working
- **notes:** Windows/PowerShell from repo root. Floor is the full grok-free suite.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Switch Agent on history tab without lose-history dead-end | T2 removes modal + implements path; source/search verify |
| Visible transcript remains; hide+reveal keeps it | T2 restore algorithm; manual smoke; buffer restore unit pieces in T1/T2 |
| New agent has prior context | T1 handoff text + T2 inject; manual “what were we doing?” |
| Empty tab still transparent + discard | T2 empty branch unchanged; existing empty-flip behavior |
| Original disk session not deleted on history flip | T2 never discard when hadHistory; manual history list |
| In-tab affordance agent changed / context applied | T3 (or T2 reusing banner) |
| Automated coverage for extract/fit | T1 |
| Docs updated | T4 |
| `npm test` green | T5 |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 4 | T2 (modal + switch path + buffer loss), T4 (doc non-goal) |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 0 | — |

Net lines: additive pure module + tests; net change in `switchBackend` replaces destructive branch. Not silent COEXIST with lose-history path.

## Open assumptions
Full ledger: `assumptions.md`.

- Product: “full context” = visible transcript + bounded text seed (not shared ACP session).
- No lose-history modal on history flip (busy/priming still guarded).
- Transcript-first; summarize only if extract unusable.
- New `activeSessionId` on target backend; old id remains on source store.

## Approval
- [x] Human approved — 2026-08-02 (user: "approve")
