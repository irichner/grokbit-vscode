# Intent — Stop showing About Grokbit after a prompt is submitted

## Problem
After the user sends a message in a session tab, the **About Grokbit** link still appears in the chat area. It should not be visible once a conversation has started; only the real turn content should remain.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] On a ready empty session tab, the welcome canvas can still show its intended empty-state chrome (including About if product keeps it there).
- [ ] After the user submits a first prompt (send), the **About Grokbit** link is **not** visible in the messages area.
- [ ] After the first prompt, the welcome **Grokbit** heading is also **not** visible (welcome chrome fully gone, not only the About text).
- [ ] Session Setup card and Grokbit Actions panel remain gone after first send (no regression of existing clear-welcome behavior for those mounts).
- [ ] A new/reset empty session still shows welcome again (including About if still mounted).
- [ ] Onboarding cards still display when required.
- [ ] Gear → **Version & about** still works (About content is not deleted from the product).
- [ ] Automated suite stays green (`npm test` from repo root).

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Redesigning the gear About panel content, update check, or fine print.
- Removing About from the empty welcome canvas *unless* the design explicitly chooses product removal (primary ask is post-submit visibility).
- Changing Session Setup, Grokbit Actions, composer, or turn-container layout beyond what is required to hide welcome correctly.
- Host/ACP/backend changes.
- Activity-bar launcher chrome.

## Constraints
- Stack / version limits: webview UI only (`media/chat.css` and related tests/markup). Prefer the established `[hidden]` override pattern already used for popovers and other display-forced elements.
- Must not break: `clearWelcome` / `resetForNewSession` / `showOnboarding` lifecycle; primer-only restore that keeps welcome up; DOM harness markup parity with `getHtml`.
- Deadline or sequencing: none; small bugfix.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` The user reports the link after submit because it incorrectly remains on screen, not because they want a different About entry point during chat. Fix = make welcome hide correctly after send.
- `UNVERIFIED` Keeping the About byline on the **empty** welcome canvas is acceptable (prior plan `welcome-chrome-simplify` intentionally left it below the cards). If the human wants it removed from empty state too, that is a one-line product add-on, not required for the post-submit bug.
- `UNVERIFIED` No questions needed: the observable failure and fix surface are fully determined from the repo.

## Questions asked
Max 3, one batch. Record the answers.

1. (none — inferred from repo + prior welcome plan)
