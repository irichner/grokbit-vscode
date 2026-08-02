# Intent — Workflow click replaces prior seed in composer

## Problem
When a user clicks a Grokbit Actions workflow tile, its slash command is inserted into the message box. Clicking another workflow appends a second command, so the box ends up with every workflow they tried instead of only the one they last chose. They must manually delete the extras before Send. Only the last workflow clicked should appear in the prompt box.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] On an empty session tab with Grokbit Actions visible, click workflow A → the message box contains only that workflow’s slash command (and any trailing space the product already uses), not a blank or a different command.
- [ ] Without clearing the box, click workflow B → the message box contains only workflow B’s slash command; workflow A’s command is gone (no stacked multi-line list of commands).
- [ ] Repeat A → B → C in either the welcome-canvas Actions panel or the top-bar Grokbit Actions popover; only the last click’s command remains.
- [ ] Clicking a workflow still does **not** auto-send; the user must press Send.
- [ ] Existing non-workflow seed paths that intentionally append (e.g. Docs “Use this document…”, host `seedComposer` when the box already has text) still append rather than wipe unrelated user text — unless they share the exact same code path we change, in which case behavior is called out under Assumptions.
- [ ] Automated tests cover: first click sets; second click replaces; no `send` posted on click.

## Non-goals
- Changing which workflows appear, their labels, or discovery.
- Auto-sending on workflow click.
- Building a multi-workflow pipeline composer (select several steps at once).
- Redesigning the Actions panel layout or tile chrome.
- Changing slash autocomplete when the user types `/` by hand.
- Persisting “last workflow chosen” across sessions.

## Constraints
- Stack: webview-only (`media/chat.js`, `media/webview-helpers.js`, vitest DOM/unit tests); no host/ACP change expected.
- Must not break: plan mode, send path, Docs seed-append, host `seedComposer`.
- Must stay grok-free: `npm test` only.
- Prefer extending existing seed helpers over a one-off only in the click handler if a pure helper keeps tests honest.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` **Replace means the composer becomes exactly the new workflow seed** when the user picks a workflow tile. If the user already typed free text after (or instead of) a prior seed, that free text is **replaced** too when they click another workflow. Rationale: the user framed the bug as “only the last workflow,” not “swap slash token keep my paragraph.” If wrong, refine to “replace only a prior lone slash-seed line.”
- `UNVERIFIED` Scope is **capability/workflow invocable rows** (`action === "invoke"` / Grokbit Actions), not every `insertComposerPrompt` call site.
- Proportionality: `scope: small` — clear UX bug, limited blast radius; short design options, 1–2 tasks.

## Questions asked
None — the request is observable and the fix is constrained enough without a product interview.
