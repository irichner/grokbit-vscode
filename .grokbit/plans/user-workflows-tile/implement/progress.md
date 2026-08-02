# Progress — user-workflows-tile

## Status

| Task | Status | Notes |
|------|--------|--------|
| T1 parsers + builders | done | Rhai + Claude JS; require meta.name |
| T2 roots + scan | done | dual backend; cross-pollution tests |
| T3 UI empty + visible | done | CAPABILITY_VISIBLE_KINDS includes workflow |
| T4 docs | done | CLAUDE.md, README, package.json |
| T5 Claude invoke | done | locked `/workflow <name> ` both backends |

## Commits

Skipped per project rule (no auto-commit). Working tree dirty with unrelated WIP; only plan files + listed sources touched for this feature.

## Verify

- `npx vitest run test/capabilities.test.ts test/webview-helpers.test.ts test/capabilities.dom.test.ts` — 317 passed
- `npx tsc -p . --noEmit` — clean
- `npm test` — see handoff
