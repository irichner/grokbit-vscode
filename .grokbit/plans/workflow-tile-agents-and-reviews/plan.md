# Plan — Agents + reviews on the Grokbit workflow tiles

Slug: `workflow-tile-agents-and-reviews` · Approach: Option C — committed pure manifest in `src/skill-suite.ts`, stamped as `CapabilityItem.meta`, rendered as data-driven wrapping meta lines, guarded by a guide-parity test · Blast radius: `skill-suite.ts`, `capabilities.ts`, `sidebar.ts`, `webview-helpers.js`, `chat.js`, `chat.css` + 5 test files; 0 deps; no schema change; no new setting

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

## Tasks

### T1 — Suite tile-meta manifest + pure stamp helper
- **intent:** Add the per-skill agents/reviews facts as committed pure data and a stamping helper, so the tile payload can carry them with zero I/O on the render path.
- **files:** `src/skill-suite.ts`, `src/capabilities.ts`, `test/skill-suite.test.ts`
- **cwd:** none
- **depends:** none
- **verify:** `npx vitest run test/skill-suite.test.ts test/capabilities.test.ts`
- **removes:** none
- **baseline:** none (additive optional field; absent `meta` is the current behavior)
- **rollback:** `git checkout -- src/skill-suite.ts src/capabilities.ts test/skill-suite.test.ts`
- **state-after:** working
- **notes:** Add `SUITE_TILE_META: Readonly<Record<string, { agents: readonly string[]; agentsNote?: string; reviews: string }>>` with the six entries from 03-design.md Decision 2. Add `meta?: { label: string; value: string }[]` to `CapabilityItem`. Add pure `attachSuiteTileMeta(items, opts?)` mirroring `attachSuiteHowItWorks`'s shape: stamp only `kind === "grokbit"` items whose name resolves through `canonicalSuiteSkillName`, returning a new array, never mutating. Ship's entry has `agents: []` + `agentsNote: "Runs each phase's own roster"`; the helper — not the renderer — decides which of the two becomes the `Agents` value. Emit no `meta` entry for an empty value.

### T2 — Guide-parity test (the anti-drift mechanism)
- **intent:** Fail the build when the manifest and `references/how-it-works.md` disagree, which is the only thing making a duplicated-facts manifest acceptable.
- **files:** `test/suite-tile-meta-parity.test.ts` (new)
- **cwd:** none
- **depends:** T1
- **verify:** `npx vitest run test/suite-tile-meta-parity.test.ts`
- **removes:** none
- **baseline:** none (new test)
- **rollback:** delete `test/suite-tile-meta-parity.test.ts`
- **state-after:** working
- **notes:** Read each `resources/skills/<name>/references/how-it-works.md`. Assert (1) every manifest role name appears in that guide's `## Roles` section and the count matches the table's bolded role rows; (2) every numeral appearing in the manifest's `reviews` string appears somewhere in that guide's `## Loops and caps` section; (3) `grokbit-ship` has `agents: []`, a non-empty `agentsNote`, and its guide still contains "Ship has none of its own". Follow the `test/hook-parity.test.ts` idiom — read the resource file, do not re-implement its content.

### T3 — Host wiring
- **intent:** Stamp the meta onto suite items in the existing pipeline so it reaches the webview payload.
- **files:** `src/sidebar.ts`
- **cwd:** none
- **depends:** T1
- **verify:** `npx tsc -p . --noEmit`
- **removes:** none
- **baseline:** none (additive payload field; a client that ignores it renders exactly as today)
- **rollback:** `git checkout -- src/sidebar.ts`
- **state-after:** working
- **notes:** Insert `attachSuiteTileMeta` between `attachSuiteHowItWorks` and `buildCapabilityGroups` (`src/sidebar.ts:3472-3482`). Do **not** move the existing calls — the `applySuiteKind`-before-`buildCapabilityGroups` ordering documented at `src/skill-suite.ts:139-143` is load-bearing. Add the import beside `attachSuiteHowItWorks` at `src/sidebar.ts:148`.

### T4 — View-model passthrough
- **intent:** Carry `meta` through `capabilityGroupsView`, which is an explicit whitelist and will otherwise silently drop it.
- **files:** `media/webview-helpers.js`, `test/webview-helpers.test.ts`
- **cwd:** none
- **depends:** T3
- **verify:** `npx vitest run test/webview-helpers.test.ts`
- **removes:** none
- **baseline:** `npx vitest run test/webview-helpers.test.ts` green before the edit (characterizes the existing view-model shape)
- **rollback:** `git checkout -- media/webview-helpers.js test/webview-helpers.test.ts`
- **state-after:** working
- **notes:** Normalize to `[{label, value}]`, dropping entries whose `label` or `value` is empty/non-string; route each `value` through the existing `truncateCapabilityDescription` so meta inherits the 260-char cap rather than introducing a second one. Emit `undefined` (never `[]`) when nothing survives, matching the `hint`/`sourceBadge` convention. Add an explicit test that `meta` survives the mapping — this is the field most likely to be lost silently.

### T5 — Renderer meta lines + styles
- **intent:** Render the agents/reviews lines on the tile face, data-driven, wrapping, with no kind-string branch and no `@media` query.
- **files:** `media/chat.js`, `media/chat.css`, `test/capabilities.dom.test.ts`
- **cwd:** none
- **depends:** T4
- **verify:** `npx vitest run test/capabilities.dom.test.ts test/chat-layout.dom.test.ts`
- **removes:** none
- **baseline:** `npx vitest run test/capabilities.dom.test.ts` green before the edit (characterizes current tile DOM)
- **rollback:** `git checkout -- media/chat.js media/chat.css test/capabilities.dom.test.ts`
- **state-after:** working
- **notes:** In `buildCapabilityRow` (`media/chat.js:804`), after the `hint` block and **before** the `hasDetail` block, append `.capability-row-meta` guarded on `Array.isArray(item.meta) && item.meta.length` — a data-shape check, never `item.kind === "grokbit"`. Render outside `.capability-row-detail-wrap` so the lines sit inside the row's own click target (clicking them seeds the command, like the description). CSS: `white-space: normal`, no line clamp, no ellipsis (the `.capability-row-desc` precedent at `media/chat.css:2492`, not the `.capability-row-hint` one); `--vscode-descriptionForeground` only, no hardcoded colors; no pixel floors so no `min(100%, …)` clamp is needed; **no `@media` query**. Add DOM tests: six suite tiles render two meta lines; a non-suite row renders none; Ship's Agents line reads the `agentsNote`.

### T6 — Full gate
- **intent:** Prove the whole suite is green and typed before the tile change is called done.
- **files:** none
- **cwd:** none
- **depends:** T5
- **verify:** `npm test && npx tsc -p . --noEmit`
- **removes:** none
- **baseline:** `npm test` green at HEAD (record the count; it is the floor)
- **rollback:** n/a
- **state-after:** working
- **notes:** Test count must be at or above the pre-change floor. If any unrelated test fails at baseline, record it before T1 so it is not attributed to this change.

### T7 — Docs sync
- **intent:** Keep the project map honest about a new user-visible tile surface and a new pure module export.
- **files:** `CLAUDE.md`, `CHANGELOG.md`
- **cwd:** none
- **depends:** T6
- **verify:** `node -e "const fs=require('fs');const c=fs.readFileSync('CLAUDE.md','utf8');if(!/SUITE_TILE_META/.test(c)){console.log('CLAUDE.md missing SUITE_TILE_META');process.exit(1)}console.log('ok')"`
- **removes:** none
- **baseline:** none (docs only)
- **rollback:** `git checkout -- CLAUDE.md CHANGELOG.md`
- **state-after:** working
- **notes:** Update § Grokbit Actions (tiles now state agents + reviews on the face) and the `src/skill-suite.ts` row in § Module map. Keep the CHANGELOG entry terse — 1–3 bullets under Added. Do **not** bump the version here; that belongs to the rebuild/release step.

## Sequencing note

T1 → T2 can run before any UI exists, so the facts are locked and guarded before a single pixel moves. T3 → T4 → T5 is a strict chain because each stage is the one that would silently swallow the field produced by the previous one.

## Human gates

- **This plan** — approval required before T1.
- **After T5** — visual check at a narrow split-editor tab and at `grok.chatFontScale` 60 / 300 before T6 is called done. The layout rules make overflow unlikely, not impossible.
