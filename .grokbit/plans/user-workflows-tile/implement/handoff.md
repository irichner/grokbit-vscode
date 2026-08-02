# Handoff — user-workflows-tile

## Phase

Implement complete (T1–T5). No auto-commit (project rule).

## Done

- Host: `CapabilityKind` + `workflow` roots/layouts, pure Rhai + Claude JS meta parsers, scan, `/workflow <name> ` invoke
- Webview: `CAPABILITY_VISIBLE_KINDS` includes `workflow`; User Workflows empty state (Grok vs Claude copy); dual mounts
- Docs: CLAUDE.md, README, package.json setting blurbs

## Verify

- `npm test` — **1491 passed**
- `npx tsc -p . --noEmit` — clean

## Files touched (feature)

- `src/capabilities.ts`
- `media/webview-helpers.js`
- `media/chat.js`
- `test/capabilities.test.ts`
- `test/webview-helpers.test.ts`
- `test/capabilities.dom.test.ts`
- `CLAUDE.md`, `README.md`, `package.json`
- `.grokbit/plans/user-workflows-tile/**`

## Snapshot

`snapshot: none` (tree already dirty with unrelated WIP; only feature files edited)

## Suggested manual smoke

1. Grok tab: put a `.rhai` with `let meta = #{ name: "…", description: "…" };` under project `.grok/workflows/` → Refresh → tile → seed `/workflow …`
2. Claude tab: put a `.js` with `export const meta = { name, description }` under `.claude/workflows/` → same
3. Empty: both backends show backend-specific User Workflows empty copy
