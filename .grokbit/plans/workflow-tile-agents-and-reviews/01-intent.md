# Intent — Agents + reviews on the Grokbit workflow tiles

## Problem
The six Grokbit suite tiles on a new session tab (Explore → Plan → Implement → Test → Document → Ship) show a name, a `/grokbit-*` chip, and one plain-language benefit line. Nothing on the tile face says **who runs** (the roles each phase delegates to) or **how much review** the phase performs. That information exists, accurately, in `resources/skills/<name>/references/how-it-works.md` — but only behind the **Details** button, one click and one host round-trip away. A user scanning the empty canvas therefore cannot tell that Plan runs four analyst roles and up to five review passes, while Explore runs three read-only roles and two cite-check rounds. The tiles read as six interchangeable buttons.

## Done criteria
Each item checkable by a human performing an observable action.

- [ ] Each of the six suite tiles renders, on its face (no click, no host round-trip), a line naming the **agents/roles** that phase runs.
- [ ] Each of the six suite tiles renders, on its face, a **review count** statement that is honest about what is being counted (rounds/passes, not an invented single number).
- [ ] Ship — which has no roles of its own — renders a truthful line saying it inherits each phase's roster, not a fabricated roster or a blank gap.
- [ ] The rendered facts match `references/how-it-works.md` for every skill; a test fails if the two disagree.
- [ ] Tiles stay readable at the narrow end (a ~250px split-editor tab) and at every `grok.chatFontScale` value — no horizontal overflow, no clipped text.
- [ ] Clicking a tile still seeds the same `/grokbit-*` slash form and nothing auto-sends; the **Details** button and **Open in editor** still work unchanged.
- [ ] Non-suite capability rows (User Workflows, and skills/agents/commands under `grok.actionsScope: all`) are visually unchanged — they gain no empty meta row.
- [ ] `npm test` green at or above the current floor; `tsc -p . --noEmit` clean.

## Non-goals
- Rewriting skill hard rules, loops, role prompts, or caps as a behavioral change. This is display only.
- Changing skill names, pipeline order, `/grokbit-*` invoke forms, or provisioning mechanics.
- Replacing or lengthening the existing one-line benefit descriptions (a multi-paragraph primary line already failed UX once — clipping and jargon).
- Adding this metadata to User Workflows (`kind: "workflow"`) — their agents are parsed from the user's own script and already surface in the workflow Details view.
- Any new user setting.
- Live re-reading of the guides on every render (that is the rejected design; see 03-design.md).

## Constraints
- Pure-logic modules stay framework-free (no `vscode`, no top-level `node:fs`); webview code is vanilla JS in `media/`.
- **No `@media` queries in `chat.css`** — `body` carries `zoom: var(--chat-zoom)`, so breakpoints evaluate the unzoomed viewport and lie at every non-default font scale.
- `min(100%, …)` clamps wherever a track or flex-basis has a pixel floor.
- The renderer must not branch on `item.kind` — `buildCapabilityRow` branches on data (`item.control`, `item.hasDetail`), and that rule holds here too.
- Must not break: the grok-free test floor, the seed-only composer contract, `CAPABILITY_VISIBLE_KINDS` scope rules, the existing Details lazy-load flow.
- Sequencing: plan only — no source edits until human approval.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` "Workflow tiles displayed on the new tab" means the `#capabilities-panel` welcome-canvas mount of the `grokbit` group — the six bundled suite skills. The Actions **popover** renders from the same builder, so it inherits the change for free; that is treated as desirable, not as scope creep.
- `UNVERIFIED` "Number of reviews" is best served by an honest short phrase per skill (e.g. "3 adversarial rounds + 1–2 plan passes") rather than one integer, because the underlying caps genuinely differ in kind. A single number would require inventing a comparison the guides do not make.
- `UNVERIFIED` Role names are shown in full rather than as a count-only chip, since the user asked to *describe* the agents involved.
- `UNVERIFIED` The metadata is static per shipped suite version, so it belongs in a committed pure manifest rather than a runtime parse — with a parity test against the guides as the anti-drift mechanism.

## Questions asked
None. Every material decision was inferable from the repo (the existing guides are the ground truth, the tile renderer's data-driven contract is established, and the parity-test idiom already exists in `test/hook-parity.test.ts`). All judgment calls are recorded above for the gate.
