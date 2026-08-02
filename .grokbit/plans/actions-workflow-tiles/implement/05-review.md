# Scope audit log — actions-workflow-tiles

Append-only, one section per task. Never overwrite a previous task's entry.

## T1 — Add the pure `visibleCapabilityGroups` filter (not yet wired)
Reviewed: working tree before commit

- `IN_SCOPE` `media/webview-helpers.js` — `CAPABILITY_VISIBLE_KINDS` + `visibleCapabilityGroups` + export
- `IN_SCOPE` `test/webview-helpers.test.ts` — import + describe block covering plan cases

Clean. Every hunk is `IN_SCOPE`; nothing to revert or promote.

### Outcome — T1
Rounds used: 1 of 2
Unresolved at cap: none

## T2 — Wire the filter into both mounts and repair the DOM tests
Reviewed: working tree before commit

- `IN_SCOPE` `media/chat.js` — `visibleCapabilityGroups` at both mounts + destructure
- `IN_SCOPE` `test/capabilities.dom.test.ts` — grokbit fixtures, empty-state rewrite, featured/expand retarget

Clean. Every hunk is `IN_SCOPE`; nothing to revert or promote.

### Outcome — T2
Rounds used: 1 of 2
Unresolved at cap: none

## T3 — Raise both description caps and make the trim sentence-aware
Reviewed: working tree before commit

- `IN_SCOPE` `src/capabilities.ts` — CAPABILITY_DESCRIPTION_MAX_CHARS 160→280
- `IN_SCOPE` `media/webview-helpers.js` — CAPABILITY_ROW_DESCRIPTION_MAX 140→260, sentence-aware trim, export
- `IN_SCOPE` `test/webview-helpers.test.ts` — real plan-description assertion
- `IN_SCOPE` `test/capabilities.test.ts` — host cap assertion

Clean. Every hunk is `IN_SCOPE`; nothing to revert or promote.

### Outcome — T3
Rounds used: 1 of 2
Unresolved at cap: none

## T4 — Render capability rows as tiles
Reviewed: working tree before commit

- `IN_SCOPE` `media/chat.css` — grid track/gap, tile chrome on `:not(.capability-row-toggle)`, wrap desc
- `IN_SCOPE` `test/capabilities.dom.test.ts` — source checks for wrap + min(100%, 300px)

Clean. Every hunk is `IN_SCOPE`; nothing to revert or promote.
Attempt note: first verify failed because a comment still contained the string
`-webkit-line-clamp`; fixed by removing the property token from the comment
and asserting property form only.

### Outcome — T4
Rounds used: 1 of 2 (one I2 diagnosis on false-positive source check; not a code-behavior retry)
Unresolved at cap: none

## T5 — Replace the three now-inaccurate strings
Reviewed: working tree before commit

- `IN_SCOPE` `media/chat.js` — both empty-state strings
- `IN_SCOPE` `src/sidebar.ts` — capabilities button title
- `IN_SCOPE` `test/capabilities.dom.test.ts` — wording assertions + source checks

Clean. Every hunk is `IN_SCOPE`; nothing to revert or promote.

### Outcome — T5
Rounds used: 1 of 2
Unresolved at cap: none

## T6 — Update the docs and run the full gate
Reviewed: working tree before commit

- `IN_SCOPE` `CLAUDE.md` — Actions + capability browser + Known limits
- `IN_SCOPE` `CHANGELOG.md` — Unreleased Changed bullet
- `OUT_OF_SCOPE` → treated as required fix under D1: `test/chat-layout.dom.test.ts`
  (260px → 300px assertion) — resolution: kept (undeclared but mandatory for green suite)
- `INCIDENTAL` `media/chat.css` comment tweak so `@media` token count stays 2

### Outcome — T6
Rounds used: 1 of 2
Unresolved at cap: none (D1 recorded; 1 of 3 deviations)
