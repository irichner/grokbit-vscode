# Plan — Session tab scroll position restore

Slug: `tab-scroll-restore` · Approach: Host-persisted stick+scrollTop; begin/end panel-replay gate on reveal · Blast radius: ~6–8 files, 0 deps, no schema

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

`cwd:` is optional — omit or write `none` for a single-package repo. Every
`verify:` runs from the repo root on Windows (PowerShell/cmd) via `npm test`.

## Tasks

### T1 — Host scroll memory + scrollState handler
- **intent:** Persist each open session’s last known stick pin and scroll offset in memory, reset on `startSession`, accept updates from the webview.
- **files:** `src/session.ts`, `src/sidebar.ts`, `src/session-scroll.ts` (pure `resetSessionScrollMemory` / `pickScrollRestore` / `applyScrollStateMessage`), `test/session-scroll.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/session-scroll.test.ts` exits 0 and asserts: (1) new Session defaults pin true / scrollTop 0; (2) `applyScrollStateMessage` coerces bad inputs; (3) `resetSessionScrollMemory` restores defaults; (4) `pickScrollRestore` returns pin/null-equivalent for defaults and `{ stickToBottom:false, scrollTop }` when unpinned. Source check: `src/sidebar.ts` `startSession` calls `resetSessionScrollMemory` (or equivalent) next to `buffer = []` — assert via pure unit of the helper **and** a source-text test that `startSession` invokes the reset (same pattern as other sidebar source-parity tests in this repo).
- **removes:** none
- **baseline:** Tab reveal always rebuilds chat from buffer and ends pinned to bottom (current UX). Session has no scroll fields today.
- **rollback:** `git revert` the commit for this task
- **state-after:** working
- **notes:** Add `scrollStickToBottom: boolean = true` and `scrollTop: number = 0` on `Session` (`src/session.ts`). Extend `WebviewMsg` with `{ type: "scrollState"; stickToBottom: boolean; scrollTop: number }`. Handle in `onMessage` via pure apply helper. Reset at the top of `startSession` next to `session.buffer = []` (`src/sidebar.ts:2077`). Do **not** clear host scroll memory inside reveal-only `router.replayInto` clear.

### T2 — Pure clamp + restore decision helper
- **intent:** Provide testable pure helpers for clamping scrollTop and choosing pin vs mid restore without touching the DOM.
- **files:** `media/webview-helpers.js`, `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npm test -- test/webview-helpers.test.ts` exits 0; new cases cover clamp below 0 / above max / exact; restore decision reuses `shouldStickToBottom` (no second near-bottom predicate)
- **removes:** none
- **baseline:** none (additive pure helpers; existing `shouldStickToBottom` tests remain green)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Export e.g. `clampScrollTop(scrollTop, scrollHeight, clientHeight)`. Can ship in parallel with T1.

### T3 — Webview panelReplaying + report/flush scrollState
- **intent:** Track panel rebuild separately from historyReplay; suppress all auto-scroll and scrollState posts during rebuild; report live scroll to host with debounce + hide flush; apply restore on end.
- **files:** `media/chat.js`, `test/tab-scroll-restore.dom.test.ts`
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/tab-scroll-restore.dom.test.ts` exits 0 and covers: (1) mid restore after begin/clear/content/end; (2) pin/null restore ends at bottom; (3) during `panelReplaying`, both `scrollToBottom` and `forceScrollToBottom` no-op; (4) after end, `forceScrollToBottom` again pins (live path); (5) no `scrollState` posts while panelReplaying; (6) visibility hidden triggers an immediate scrollState flush
- **removes:** none (behavior of unconditional stick-on-reset is replaced at the gate, not a deleted export)
- **baseline:** Live stick-to-bottom while visible (#16); scroll-to-bottom button (#28); `clearMessages` → pin true (`media/chat.js:2692`); force-scroll on userMessage/permission/question
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Distinct `state.panelReplaying` (default false) — **never** reuse `state.replaying`. `beginPanelReplay` stashes restore; `resetForNewSession` does not force stick when panelReplaying; both scroll helpers no-op while panelReplaying; `endPanelReplay` applies clamp + `shouldStickToBottom`, `updateScrollBtn`, then one authoritative `scrollState`. Immediate flush on `document.hidden`. Suppress scroll-listener host posts through the end authoritative post. Init defaults on state bag.

### T4 — Wire begin/end around host replayInto
- **intent:** On every ready-driven rebuild, send begin → existing clear+buffer+derived → end (try/finally), using host scroll memory for the restore payload.
- **files:** `src/sidebar.ts`, `src/session-scroll.ts` (shared pure sequence helper optional), `test/panel-replay-scroll.test.ts`
- **cwd:** none
- **depends:** T1, T3
- **verify:** `npm test -- test/panel-replay-scroll.test.ts` exits 0. **Required** assertions (not optional): (1) pure `buildPanelReplayEnvelope(session)` (or equivalent) emits message types in order `beginPanelReplay` → …caller runs router… → `endPanelReplay`; (2) source-text or unit test that `GrokSidebar.replayInto` / its extracted helper posts `beginPanelReplay` **before** invoking `router.replayInto` and posts `endPanelReplay` in a `finally` after; (3) mid-scroll session yields `restore.stickToBottom === false`; default session yields pin/null restore. Also `npm test -- test/panel-router.test.ts test/tab-scroll-restore.dom.test.ts` exits 0 (router unchanged; DOM still green).
- **removes:** none
- **baseline:** `ready` → markReady → postPanelConfig → replayInto only (`src/sidebar.ts:2727–2735`); `PanelRouter.replayInto` always starts with clearMessages (`src/panel-router.ts:103`)
- **rollback:** `git revert`
- **state-after:** working
- **notes:** Prefer wrapping only `GrokSidebar.replayInto` (do not change `PanelRouter.replayInto` signature unless tests force it). Use try/finally so end always posts if begin did. Extract a pure “ordered envelope” helper if that is the only way to unit-test without vscode — but the source-order check on `sidebar.ts` is mandatory so the wrap cannot be skipped while suite stays green.

### T5 — Full suite + human checklist document
- **intent:** Prove no regressions in the grok-free suite and leave a short manual checklist for the done-criteria that need a real VS Code multi-tab interaction.
- **files:** none required beyond prior tasks; optional note under this plan’s `assumptions.md` Resolution if anything is human-only
- **cwd:** none
- **depends:** T4
- **verify:** `npm test` exits 0 (entire suite)
- **removes:** none
- **baseline:** suite green before change (run once in baseline mode of grokbit-test)
- **rollback:** n/a (verification task)
- **state-after:** working
- **notes:** Automated tests cannot fully drive VS Code editor-tab hide/reveal; done-criteria 1–4 need a short manual pass after install. Criteria 5–7 are largely covered by existing + new DOM tests.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| Mid-scroll survives tab switch (no jump to bottom) | T3 mid-restore DOM + T4 wire + T5 manual |
| Bottom pin survives tab switch | T3 pin restore DOM + T4 + T5 manual |
| At bottom, AI stream stays pinned | T3 (stick true after restore) + existing scrollToBottom gate + T5 manual |
| Mid-scroll, background growth does not yank | T3 mid restore with taller content + force no-op during replay + T5 manual |
| Live mid-scroll still does not force-follow | Existing #16 tests + T3 does not break scroll listener |
| Visible permission/question still force-scroll | T3: force works when `!panelReplaying`; baseline DOM permission tests stay green |
| New/short session starts pinned | T1 defaults + T3 null restore + startSession reset |

## Disposition summary
Carried from `03-design.md`.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 2 (unconditional stick-on-reset behavior; implicit force-to-bottom during reveal replay) | T3 gates |
| DEPRECATE | 0 | — |
| COEXIST | 0 | — |
| LEAVE | 1 (gap filled by new host fields) | T1 adds fields |

Net lines: expected small positive (+host fields, begin/end handlers, tests). Not an accidental COEXIST of two scroll systems — one stick policy, gated for panel rebuild.

## Open assumptions
Full ledger: `assumptions.md`.

- `UNVERIFIED` session editor tabs only; absolute scrollTop keep-same-messages when growth is append-only; window-reload persistence optional; pending cards while restoring mid-scroll stay off-screen until user scrolls or a new live card forces.

## Approval
- [x] Human approved — 2026-08-01 (via `/grokbit-implement this plan`)
