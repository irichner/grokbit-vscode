# Implement handoff — actions-workflow-tiles

Input contract for `grokbit-test` verify mode.

## Completed
- T1 `c829b07` — pure `visibleCapabilityGroups` + `CAPABILITY_VISIBLE_KINDS` (not wired)
- T2 `aed8bef` — wire filter into both Actions mounts; retarget DOM fixtures
- T3 `26ff9a6` — host cap 280, webview cap 260, sentence-aware trim
- T4 `41226cd` — tile CSS for workflow rows; wrap descriptions
- T5 `7ccb0d5` — empty-state strings + button tooltip
- T6 `54c03de` — CLAUDE.md / CHANGELOG.md; full suite + tsc (plus D1 chat-layout assert)

## Blocked
- none

## Surface changed
Files:
- `media/webview-helpers.js` — allowlist filter, sentence-aware truncate, exports
- `media/chat.js` — filter at both mounts, empty-state copy
- `media/chat.css` — tile chrome, grid track 300px, wrap desc
- `src/capabilities.ts` — `CAPABILITY_DESCRIPTION_MAX_CHARS` 280
- `src/sidebar.ts` — Actions button `title`
- `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`, `test/capabilities.test.ts`, `test/chat-layout.dom.test.ts` (D1)
- `CLAUDE.md`, `CHANGELOG.md`

Endpoints added/changed: none  
Schema changes: none  
UI views affected: Grokbit Actions welcome panel, Actions popover, capability tiles  
Dependencies added: none

## Look here hard
- Empty state when suite absent (provision off): panel + popover copy and no Skills/Agents/Commands headings
- Both mounts still share Session controls Auto-accept (popover only)
- Sentence-aware trim on real grokbit-plan description (complete sentences, no mid-word …)
- Manual look still required for multi-column / no h-scroll (happy-dom does not lay out)
- `visibleCapabilityGroups` applied *before* empty-state `viewGroups.length` checks

## Deviations
See `deviations.md` — **1** recorded (D1 undeclared `test/chat-layout.dom.test.ts`).

## Baseline reference
NOT CAPTURED as formal `test/baseline.md` — plan T2–T5 baselines were descriptive UI snapshots; preflight suite was green (1338 → 1347 after this work). Regression claims against formal characterization tests are limited; suite + done-criteria checks remain valid.
