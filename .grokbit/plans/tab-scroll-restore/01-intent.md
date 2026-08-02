# Intent — Session tab scroll position restore

## Problem
When a user switches away from a Grokbit session tab and clicks back, the chat view does not stay where they left it. The tab appears to start at the top and then jumps or scrolls all the way to the bottom. They want the view to stay at the scroll position they had. The only exception is when they were already at the bottom: in that case the tab should remain at the bottom so new AI output stays in view.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] Open a session with enough history to scroll. Scroll mid-conversation (not near the bottom). Switch to another editor tab, then click back to the Grokbit session tab. The same mid-conversation region is still on screen (no jump to the bottom).
- [ ] With the same long session scrolled to the bottom (the floating “Scroll to bottom” control is hidden), switch away and back. The chat is still at the bottom.
- [ ] With the session at the bottom and a turn in progress (or start a turn after returning), streaming AI content keeps the view pinned to the bottom.
- [ ] With the session scrolled mid-history (not pinned), switch away, let the agent produce more output in the background (or switch back mid-turn), then return: the view does **not** yank to the bottom; it restores the prior mid-history position (or as close as layout allows after new content is appended below).
- [ ] While the tab is visible and the user has scrolled up, live streaming still does **not** force-scroll (existing #16 stick-to-bottom behavior remains).
- [ ] Interactive events that already force-scroll (sending a message, permission/question cards) still bring the view to the bottom when they fire on a visible tab.
- [ ] A brand-new empty or short session still starts pinned to the bottom (no regression on first open).

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Flipping `retainContextWhenHidden` to `true` as the primary fix (that dial owns the ready/replay lifecycle; redesigning host delivery is a separate project).
- Changing launcher history list scroll, popover scroll, tool-output expanders, or activity-carousel internal scroll.
- Persisting scroll across full VS Code window reloads / panel serializer restore (nice if free; not required for done).
- Virtualizing the message list or rewriting chat layout for performance.
- Changing how buffered messages are delivered while a tab is hidden (only how the restored view is positioned after replay).
- New user-facing settings for scroll behavior.

## Constraints
- Stack / version limits: VS Code webview panel architecture as-is; pure helpers stay testable without `vscode`; DOM behavior covered by existing happy-dom harness patterns.
- Must not break: live stick-to-bottom while pinned (#16); scroll-to-bottom button (#28); buffer replay losslessness on tab reveal; plan/permission cards force-scroll; primer-only and resume paths that use `clearMessages`.
- Deadline or sequencing: none stated; small UX fix preferred over architectural rewrite.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “Click on a tab” means Grokbit **session editor tabs** (`grok.session` WebviewPanel), not the activity-bar launcher list.
- `UNVERIFIED` “Hold its view” means keep the same approximate scroll offset into the message list after hide→reveal rebuild; if content only grew at the bottom while hidden, absolute `scrollTop` keeps the same messages in view.
- `UNVERIFIED` Restoring scroll after hide→reveal within the same VS Code window is sufficient; surviving a full window reload is optional.
- `UNVERIFIED` When the user was mid-scroll and a permission/question arrives while the tab is **visible**, existing force-scroll-to-bottom still applies (safety/UX for interactive cards). While the tab was **hidden**, restore mid-scroll on reveal rather than auto-jumping to a card that arrived while away — unless product later decides otherwise (not required for v1).

## Questions asked
Max 3, one batch. Record the answers.

None — every plan-changing ambiguity was either inferable from the bug description + existing stick-to-bottom design, or recorded as an assumption above.
