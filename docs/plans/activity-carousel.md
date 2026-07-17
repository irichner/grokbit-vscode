# Activity carousel — compact per-turn activity block

**Goal:** during long agentic turns the chat fills with narration bubbles, tool-group
rows, and thinking rows — the user scrolls constantly. Collapse each turn's working
activity into ONE carousel-style block so the transcript barely grows while grok works.

**Out of scope:** interactive cards (permission/question/plan) stay full-size in the
transcript (they need answers); generated media / document cards stay visible
(deliverables); the changed-files strip, donut, status bar are untouched.

## Design

- New per-turn block `.activity-carousel`, created lazily on the first tool call or
  thought of a turn (webview-only; no host/ACP changes beyond a setting).
- **Collects:** tool groups (existing `.tool-group` DOM moves inside), thinking blocks
  (`.msg.thinking`), and the narration bubble that introduced each batch (the one
  `addToToolGroup` already "detaches" — now it physically moves into the block and
  becomes a step). The final answer bubble is never pulled in (nothing follows it).
- **Live:** a one-row strip = category icon + current action label (animated slide on
  change) + blinking dots + step counter + `‹ ›` peek nav (carousel: flip back through
  earlier step labels; auto-returns to live) + expand chevron. Expanding shows the full
  detail in a bounded scroll area (`max-height`), auto-following while live.
  With `showThinking` on, the block starts expanded so opted-in traces stream visibly.
- **Done (`finalizeActivity`, from `commitAgentTurn` + card/deliverable boundaries):**
  strip becomes a summary row — `summarizeTools(allCalls)` + `· N steps`; nav + dots
  removed; body collapsed; still expandable. Failure inside → `has-error` tint.
- **Single-item unwrap:** a block whose body holds exactly one item (one tool batch, or
  a thinking-only turn) unwraps back to the bare element — simple turns look exactly
  like today (incl. `.msg.thinking` staying hidden under `thinking-hidden`, and the
  lone-read `.tool-flat` flatten).
- **Segment breaks** (block frozen; next activity starts a new block): permission /
  question / plan cards, document cards, generated media, subagent cards, errors, plan
  notices, session-context banner, restored permission/question cards. Keeps the DOM
  append-only and chronology exact. In classic mode `finalizeActivity()` is a no-op, so
  legacy behavior is bit-identical.
- **Replay** uses the same code path — restored sessions render one collapsed summary
  row per turn (boundaries via the existing `commitAgentTurn` calls). Primer
  suppression unaffected (suppressed turns emit nothing).
- **Indicators:** the strip replaces the standalone "Thinking…" row while carousel is
  on; `Grokking` stays the pre-content indicator; `turnHasVisibleActivity()` counts a
  live block.
- **Setting `grok.compactActivity`** (boolean, default **true**, webview-only) — same
  plumbing as `grok.showThinking`: package.json contributes, `initialState` field,
  config-watcher broadcast (`compactActivity` message), gear → Config & debug switch
  (`setCompactActivity`). Off = classic scrolling stream (new turns only; flipping off
  mid-turn finalizes the live block).

## Work packages

1. **Webview core** — `media/chat.js` (state, `ensureActivityBlock` / `activityStep` /
   `renderActivityStrip` / `stepActivityView` / `finalizeActivity`, hooks in
   `addToToolGroup` / `appendThought` / `commitAgentTurn` / breakers / dispatcher /
   `markToolFailed` / `turnHasVisibleActivity` / `resetForNewSession`, gear switch),
   `media/chat.css` (strip/body/nav/anim styles), `media/webview-helpers.js` (pure
   `activityPeek` + `activityPosText`).
2. **Host plumbing** — `package.json` setting; `src/sidebar.ts` (`compactActivity()`,
   `postCompactActivity()`, initialState field, watcher, `setCompactActivity` handler).
3. **Tests** — new `test/activity-carousel.dom.test.ts` (block creation, strip label /
   counter, peek nav, finalize summary, single-item unwrap, thinking-only unwrap,
   segment breaks, classic-mode off-switch, replay, failure tint); update DOM tests
   that assert `#messages` child order (tool-summary interleave/cards, friendly-ui,
   webview-ui, …); `webview-helpers.test.ts` additions for the pure helpers.
4. **Docs + rebuild** — CLAUDE.md (§ Chat surfaces bullet + module-map cell + settings
   bullet), README features line, docs/architecture.md, CHANGELOG section; then
   `npm run rebuild` (bump + package + reinstall). No commit/push (repo convention).

## Verification

`npm test` green (748+ floor), `tsc -p . --noEmit` clean, code-reviewer pass over the
full diff. Manual smoke after reinstall: long multi-batch turn → one strip; expand;
peek; permission-gated turn; replay of an old session; toggle off → classic.
