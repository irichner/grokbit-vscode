# Implement handoff — session-setup-top-bar

Input contract for `grokbit-test` verify mode.

## Completed
- T1 deferred — dual-anchor `#session-settings-popover` (top-bar below-chip / composer above)
- T2 deferred — pure `sessionSetupChipLabel`
- T3 deferred — top-bar chip shell, CSS, paint, wire, truth table
- T4 deferred — `test/session-setup-chip.dom.test.ts` (10 tests)
- T5 deferred — README + CLAUDE docs

## Blocked
- none

## Surface changed
Files:
- `media/chat.js`
- `media/chat.css`
- `media/webview-helpers.js`
- `src/sidebar.ts`
- `test/webview-harness.ts`
- `test/webview-helpers.test.ts`
- `test/session-setup-chip.dom.test.ts` (new)
- `README.md`
- `CLAUDE.md`
- plan artifacts under `.grokbit/plans/session-setup-top-bar/`

Endpoints added/changed: none  
Schema changes: none  
UI views affected: session tab top-bar + session-settings popover open path  
Dependencies added: none

## Look here hard
- Dual-anchor re-parent: open from top chip vs model chip — both tested in `session-setup-chip.dom.test.ts`
- Welcome card still hides on first send (`session-setup.dom.test.ts`) while chip remains
- Narrow top-bar: chip ellipsis + `margin-left: auto` on history
- Busy lock is on popover rows, not chip disabled
- Onboarding hides chip

## Deviations
See `deviations.md` — 0 counting.

## Dirty-tree snapshot
| Kind | Identity | Restored at handoff? |
|---|---|---|
| none | (proceed dirty; plan dir + unrelated paths pre-existed) | n/a |

## Baseline reference
Captured: `implement/baseline-notes.md` + preflight model-chip green  
Also: repo `test/baseline.md` is for a prior slug (chat-turn-containers)

## hand_back_cycle
0

## Commits
Deferred per project CLAUDE.md (user did not request commit). Say the word to commit per task or as one change.
