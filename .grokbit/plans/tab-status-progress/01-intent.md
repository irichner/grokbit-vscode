# Intent — Session tab status + progress

## Problem
When several Grokbit sessions are open as editor tabs, it is hard to tell at a glance which tab is still running, which finished, and which is waiting for the user (permission, question, or plan review). The launcher list already has status dots, and the status bar reflects the *active* session, but the editor tab itself still looks the same for every state. During longer implementation work, there is also no lightweight progress cue on the tab itself.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] With two session tabs open, starting a turn in tab A makes tab A’s editor-tab chrome (title and/or icon) clearly show a **running** state without requiring the user to focus that tab or open the launcher.
- [ ] When tab A raises a permission card, question card, or plan-review card, tab A’s editor-tab chrome clearly shows a **needs attention / answer** state even if another tab is focused.
- [ ] When a turn finishes successfully and the user is not looking at that tab, the tab still communicates **done / finished** (or an equivalent “finished while you were away” signal) until the user opens it, without being confused with “still running.”
- [ ] When a tab is idle and has been viewed (no pending attention), its chrome does **not** keep a permanent “running” or “needs answer” mark.
- [ ] During a multi-step agentic turn (implementation-style work with tools/steps), the working tab shows a **progress cue** on the tab (text progress, step count, or proportional indicator—not only a static “working” word).
- [ ] Existing launcher dots and the status-bar HUD continue to work; this change does not remove those surfaces.
- [ ] Automated unit tests cover pure title/status/progress formatting (truncation, status precedence, empty name, progress present/absent).

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Redesigning the in-chat activity carousel, tool rows, or permission/question card UI.
- A real native OS progress bar widget inside the VS Code tab strip (the platform does not expose one on `WebviewPanel`).
- Plan-file / `grokbit-implement` task-list parsing as the sole progress source (nice later; not required if host-visible turn progress is enough).
- Changing how status is computed for launcher dots (`working` / `needs-you` / unread policy) beyond what is needed to keep tab chrome consistent.
- Custom tab colors, workbench theming, or new Marketplace settings unless a single optional setting is strictly required (default should be on).
- Subagent nesting inspectors, media generation, or backend-specific (Grok vs Claude) different status models.
- Auto-focus / steal focus when a background tab needs the user (status-bar notify already covers opt-in navigation).

## Constraints
- Stack / version limits: VS Code extension; editor tabs are `WebviewPanel` with string `title` + optional `iconPath` only.
- Must not break: existing `Model·effort — Name` settings-prefix title policy (settings must still be readable when the tab is narrow); launcher dots; status-bar HUD; session restore / panel serializer.
- Must stay pure-testable for formatting/policy (host wiring only in `sidebar`-class glue).
- Must not introduce network or new npm dependencies for this feature.
- Deadline or sequencing: none; ship as a focused UX improvement.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “Needs questions answered” means the existing host `needs-you` status (permission, ask-user question, plan review)—not a new card type.
- `UNVERIFIED` “Done” means the user-visible finished-while-away signal (existing unread/done path for background tabs), not a permanent green check that sticks forever after every turn while the tab is focused.
- `UNVERIFIED` “Progress bar during implementation” is best-effort on the tab chrome using step/progress text (and optional proportional unicode or similar) from host-visible turn activity; a full webview progress ribbon is optional only if title-only progress is too weak after design.
- `UNVERIFIED` Status should be encoded primarily as a **prefix** (or leading icon) because VS Code truncates tab titles from the end—matching the existing settings-prefix rationale.
- `UNVERIFIED` No new user setting required; behavior on by default.

## Questions asked
Max 3, one batch. Record the answers.

1. Q: *(none asked — product already has `working` / `needs-you` / `done` / unread; tab chrome is the missing surface; platform limits rule out a true native tab progress widget)* → A: n/a
