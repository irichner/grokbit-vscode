# Intent — Session tabs survive VS Code reload / restart

## Problem
When the user reloads the VS Code window or fully closes and reopens VS Code, previously open Grokbit session tabs do not come back correctly. Tabs that should resume the same conversations either show up empty/new, fail to attach to the old session, or otherwise do not restore a usable chat view. The user expects old tabs to reappear and show the same conversation they had before the reload.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] Open at least two Grokbit session tabs with real conversation history (send a message and get a reply in each). Run **Developer: Reload Window**. Both tabs reappear; each shows its prior conversation (not a blank welcome / brand-new empty chat).
- [ ] Same setup, then fully quit VS Code and reopen the same workspace. Previously open Grokbit session tabs restore and show their prior conversations (or, if VS Code itself does not restore editor tabs for this workspace layout, the sessions remain reachable from the launcher Recent list and reopen with full history — see assumptions).
- [ ] A restored tab that was Claude before reload still runs Claude (composer backend chip / behavior), not silently Grok.
- [ ] A restored tab that was Grok before reload still runs Grok.
- [ ] While a restored tab is still connecting (composer locked / busy), opening the same session again from the launcher or history popover does **not** create a second duplicate editor tab for that session — it reveals the existing one.
- [ ] Background restored tabs (not focused at reload) still resume their session when first focused, with history visible after load.
- [ ] If the underlying on-disk session is gone, the tab fails clearly (error or honest empty/onboarding), not as a silent wrong conversation.

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Fixing mid-window hide→reveal **scroll position** only (that is `.grokbit/plans/tab-scroll-restore/`; this plan may keep identity/history correct across full reload, but scroll pin after cold restore is optional).
- Flipping `retainContextWhenHidden` to `true` as the primary fix (deliberate dial for ready/replay lifecycle).
- Changing launcher history pagination, session delete/clear-all, or ACP wire protocol.
- Making restored background tabs eagerly spawn every CLI process at reload (lazy-on-reveal is intentional).
- Virtualizing the message list or rewriting the panel router delivery model.
- New user-facing settings for restore behavior.
- Guaranteeing VS Code itself always restores every editor tab after a full app quit when the user (or OS) discarded the workspace layout — only Grokbit’s identity + resume path when a panel is restored.

## Constraints
- Stack / version limits: existing `WebviewPanel` + `WebviewPanelSerializer` architecture; pure helpers stay free of `vscode` for unit tests; suite remains grok-free.
- Must not break: cold open from launcher (`openTabForId` + `session/load`), in-window hide→reveal buffer replay, empty-primer recycle, dual-backend resume, `pendingStart` lazy spawn after CLI update.
- Deadline or sequencing: none stated; correctness of reload restore over cosmetics.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “Old tabs don’t reload properly” primarily means **conversation identity / history** is wrong or missing after reload, not only scroll position (scroll has a separate plan that excluded full-window reload).
- `UNVERIFIED` **Developer: Reload Window** is the primary repro; full quit/reopen should follow the same serializer path when VS Code restores the workspace’s editor tabs.
- `UNVERIFIED` Users expect restored tabs to **resume** via `session/load`, not start a new ACP session that only shares a title.
- `UNVERIFIED` Duplicate-tab while connecting is in scope because it is caused by the same identity gap during restore startup.

## Questions asked
Max 3, one batch. Record the answers.

None — plan-changing ambiguities were either inferable from the product map / restore code path, or recorded as assumptions above. If the live symptom is only “Failed to start Grok” (CLI/auth) with history otherwise fine, say so at the gate and this plan can narrow; the default is identity + history restore.
