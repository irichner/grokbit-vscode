# Intent — workflow-title-and-color

## Problem
The Grokbit Actions workflow tiles display raw skill names like "grokbit-explore", "grokbit-plan", etc. These are internal identifiers, not user-facing labels. The tiles also have no visual distinction from other UI elements — they use the same neutral `editorWidget` background as session cards and generic surfaces.

## Done-criteria
- [ ] Workflow tile names display without the `grokbit-` prefix and with each word capitalized (e.g. "Explore", "Plan", "Implement", "Test", "Document")
- [ ] Workflow tiles have a visible color accent that distinguishes them from other neutral UI elements (using the existing cyberpunk palette)
- [ ] All existing tests pass (`npm test` green)
- [ ] No regression in the capability browser's locked/inert/toggle row behaviour

## Non-goals
- Changing the underlying skill names on disk or in the host payload
- Adding icons or images to the tiles
- Changing the slash-command chip (`invokeLabel`) — it should still show the full `/grokbit-explore` form
- Changing any other capability kind's styling (skills, agents, commands)
- Touching the host-side code (`src/capabilities.ts`, `src/skill-suite.ts`)

## Constraints
- The label transform must be in the pure view-model (`capabilityGroupsView` in `webview-helpers.js`), not in the renderer (`chat.js`), since both mounts share one builder
- CSS must use VS Code theme variables with `color-mix` fallbacks (the cyberpunk `--neon-*` custom properties), not hardcoded hex — light/dark themes must both work
- No `@media` queries (documented prohibition in chat.css)
