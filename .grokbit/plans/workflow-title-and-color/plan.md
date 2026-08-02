# Plan — workflow-title-and-color

- [x] Approved

## T1 — Strip `grokbit-` prefix and capitalize workflow labels in the view-model

**intent:** Display workflow tiles as "Explore", "Plan", "Implement", "Test", "Document" instead of "grokbit-explore", etc. The `name` field (identity key) and `invokeLabel` (slash chip) stay unchanged.

**files:**
- `media/webview-helpers.js` — in `capabilityGroupsView`, change the `label` assignment for `grokbit`-kind items
- `test/webview-helpers.test.ts` — add assertions that `grokbit`-kind items get the stripped/capitalized label

**verify:** `npx vitest run test/webview-helpers.test.ts`
**baseline:** existing `capabilityGroupsView` tests that assert on `item.label` matching `item.name`
**removes:** none

## T2 — Add cyan accent border to workflow tiles

**intent:** Give workflow tiles a visible colour accent (a left border in `--neon-cyan`) that distinguishes them from neutral UI surfaces. Uses the same `color-mix` idiom as the rest of the cyberpunk palette.

**files:**
- `media/chat.css` — add `border-left` to `.capability-row:not(.capability-row-toggle)`

**verify:** `npx vitest run test/capabilities.dom.test.ts`
**baseline:** existing tile border rendering
**removes:** none
