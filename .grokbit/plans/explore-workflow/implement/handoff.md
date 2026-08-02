# Handoff — explore-workflow → grokbit-test

## Tasks
| Task | Status |
|---|---|
| T1 suite + webview name lists | done |
| T2 grokbit-explore skill package | done |
| T3 docs + package.json | done |
| T4 unit/DOM tests | done |
| T5 full suite + wiring | done |

## Files touched
- `src/skill-suite.ts`
- `media/webview-helpers.js`
- `resources/skills/grokbit-explore/**` (new)
- `resources/skills/README.md`
- `resources/skills/grokbit-plan/SKILL.md`
- `resources/skills/grokbit-test/references/host-adapters.md`
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `package.json`
- `test/webview-helpers.test.ts`, `test/capabilities.dom.test.ts`

## Dependencies added
none

## Deviations
none counting toward replan cap

## Verify evidence
- `npm test` — 1391 passed
- `npx tsc -p .` — clean
- `out/skill-suite.js` — `SUITE_SKILL_NAMES[0]==='grokbit-explore'`, length 5

## What test should look at hard
1. Featured order explore-first (helpers + DOM)
2. First Actions row seeds `/grokbit-explore ` without send
3. Skill package presence + hard-rule strings (chat-only, read-only)
4. Settings strings mention Explore / grokbit-explore
5. Manual after rebuild (residual): Actions five tiles, invoke Explore, chat map without source edits

## Open residual (from assumptions.md)
- Conversational quality of Explore is manual after green tests
- Commits not made — user must commit when ready
