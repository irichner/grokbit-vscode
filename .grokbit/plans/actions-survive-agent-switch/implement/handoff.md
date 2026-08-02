# Implement handoff — actions-survive-agent-switch

Input contract for `grokbit-test` verify mode (optional). Commits deferred.

## Completed
- T1 (uncommitted) — keep Actions on `backendChanged`; re-request only on real Agent flip
- T2 (uncommitted) — DOM regression for stay-visible + flip-only re-request
- T3 — full suite green: **1419** tests passed

## Blocked
None.

## Surface changed
Files: `media/chat.js`, `test/capabilities.dom.test.ts`  
Endpoints: none  
Schema: none  
UI views affected: welcome Grokbit Actions panel across Session Setup Agent switch  
Dependencies added: none

## Look here hard
- Manual smoke: empty tab → change Agent under Session Setup → Actions should stay; no need to switch tabs.
- `actionsScope: "all"`: non-suite skills may briefly reflect previous backend until scan returns (accepted).
- `replayInto` same-backend `backendChanged` must not blank Actions (covered by same-backend branch of T2 test).

## Deviations
See `deviations.md` — 0 counting; baseline + commit waivers only.

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| none | plan dir was already dirty; no stash | n/a |

## Baseline reference
NOT CAPTURED — T1 baseline was the bug under fix (waived).

## hand_back_cycle
0
