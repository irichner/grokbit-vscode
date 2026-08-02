# Intent — Session setup always available at top of tab

## Problem
On a new session tab, **Session setup** (Agent / Model / Thinking / Mode) is
obvious on the welcome canvas. After the user sends a first prompt, that card
disappears with the welcome screen. Users still need to change those settings
mid-conversation, but the only remaining path is easy to miss (a small chip in
the **bottom** composer toolbar). They want a **clever, top-of-tab** surface
that stays available after the first prompt and spends **as little vertical
space** as possible.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] After sending at least one prompt (welcome canvas gone), the user can still open **Agent / Model / Thinking / Mode** without leaving the session tab.
- [ ] That access is reachable from the **top** of the session tab (header area), not only from the bottom composer.
- [ ] The always-on chrome for this control uses **minimal vertical space** (does not add a multi-row card under the messages; target: reuses the existing top-bar row, or at most one thin ~one-line strip).
- [ ] Changing each control still works mid-session the same way it does today (Agent → backend switch; Model → setModel; Thinking → setEffort; Mode → setMode), including lock-while-busy.
- [ ] Empty/new tabs still present Session setup clearly (welcome card may remain; behavior for “free to change before first send” stays honest).
- [ ] Existing DOM/unit tests for the shared builder and current mounts stay green; new coverage proves the top-of-tab mount appears after first send.

## Non-goals
- Redesigning the full gear menu, Docs, or Grokbit Actions surfaces.
- A permanent multi-row Session setup **card** under the messages after chat starts (that violates minimal vertical space).
- Host/ACP protocol changes beyond existing `switchBackend` / `setModel` / `setEffort` / `setMode` messages.
- Changing when restarts or history-loss confirms fire (only *where* the controls are shown).
- Moving Mode off the bottom mode button (mode button may stay; this is not “delete all other mode UIs”).
- Status-bar HUD redesign (`src/status-bar.ts`) — native VS Code chrome is out of scope.
- Responsive redesign of the entire top-bar icon set.

## Constraints
- Stack: webview-only UI (`media/chat.js`, `media/chat.css`, `media/webview-helpers.js`, `src/sidebar.ts` HTML shell if needed); pure builder pattern preferred.
- Must not break: welcome Session setup card, composer quick-settings popover (unless design deliberately consolidates), plan-mode banner, capability browser mounts, busy/lock behavior.
- Prefer reusing `sessionSetupModel` + existing `#session-settings-popover` / row builders rather than a third control implementation.
- Tests: `npm test` (vitest, grok-free DOM tests). Windows-native shell for verify commands.
- No `@media` breakpoints in `chat.css` (zoom/`grok.chatFontScale` policy).

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- Users primarily miss the **placement/discoverability** of mid-session setup, not the host ability to change settings (the model chip already opens the four controls).
- “Top of the tab” means inside or immediately under the existing `.top-bar` in the webview, not the VS Code tab title strip.
- Minimal vertical space prefers **zero extra rows** (chip inside top-bar) over a second always-expanded control strip.
- Welcome-canvas full card remains valuable for empty tabs (education + “free to change” copy); this plan does not remove it unless a later design option chooses one strip for all states.
- Claude still omits Thinking (no effort axis) — same as today.

## Questions asked
None — answers that would change the plan are inferable from the request (“top of tab”, “minimal vertical space”) and existing dual-mount pattern. Residual product choice (whether to keep or hide the bottom model chip) is deferred to Design as a disposition, not a blocking question.
