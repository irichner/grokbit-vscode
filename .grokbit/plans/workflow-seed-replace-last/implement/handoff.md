# Implement handoff — workflow-seed-replace-last

Input contract for `grokbit-test` verify mode.

## Completed
- T1 (uncommitted) — capability/workflow clicks use `applyComposerSeed` replace mode so only the last seed remains in the composer; Docs/host seeds still append.

## Blocked
- none

## Surface changed
Files: `media/webview-helpers.js`, `media/chat.js`, `test/studio-3.0.test.ts`, `test/capabilities.dom.test.ts`  
Endpoints: none  
Schema: none  
UI: Grokbit Actions / capability row click → composer seed  
Dependencies added: none

## Look here hard
- Capability onclick is the only product path using replace; Docs Use and `seedComposer` must still append.
- Free-text wipe on workflow click is intentional (plan assumption).
- Same working tree may still contain unrelated `backendChanged` fix from `actions-survive-agent-switch` in `media/chat.js` — do not conflate when reviewing diffs.

## Deviations
See `deviations.md` — 0 counting.

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| none | — | n/a |

## Baseline reference
NOT CAPTURED as `test/baseline.md` — characterized via pre-change targeted suite green.

## Verify evidence
`npm test -- --run test/studio-3.0.test.ts test/capabilities.dom.test.ts` → 84 passed (16 + 68).
