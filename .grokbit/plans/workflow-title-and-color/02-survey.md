# Survey — workflow-title-and-color

## Entities

### Label assignment
- `media/webview-helpers.js` — `capabilityGroupsView` function, the line `label: raw.name || ""` (approx. line within the function body). This is where the display label is set. `raw.name` comes from the host's `CapabilityItem.name`, which is the skill's file-derived or frontmatter name (e.g. `"grokbit-explore"`).
- The `invokeLabel` is set separately: `invokeLabel: invoke ? invoke.trim() : undefined` — this is the slash form (`/grokbit-explore`) shown as a small `.capability-row-cmd` chip. The intent says NOT to change this.

### Name source
- `src/capabilities.ts` — `capabilityFromSkillFile` derives `name` from the directory basename (e.g. `grokbit-explore/SKILL.md` → `"grokbit-explore"`) or frontmatter `name:` field. NOT touched by this change.
- `src/skill-suite.ts` — `SUITE_SKILL_NAMES` lists: `["grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document"]`. NOT touched.

### Kind detection
- `src/skill-suite.ts` — `applySuiteKind` reclassifies items from `kind: "skill"` to `kind: "grokbit"` when name + path match. The `kind` field is what `capabilityGroupsView` sees.
- Items with `kind === "grokbit"` are the ONLY ones that render in the Actions UI (via `visibleCapabilityGroups` filtering on `CAPABILITY_VISIBLE_KINDS = ["grokbit"]`).

### CSS for tiles
- `media/chat.css:2046` — `.capability-row` — base row: flex column, gap 1px, padding 6px 8px, pointer cursor.
- `media/chat.css:2056` — `.capability-row:not(.capability-row-toggle)` — tile chrome for workflow rows only: `padding: 10px 12px 12px`, `gap: 4px`, `background: var(--vscode-editorWidget-background, ...)`, `border: 1px solid var(--vscode-editorWidget-border, ...)`, `border-radius: var(--radius, 6px)`.
- `media/chat.css:2063` — `.capability-row:hover` and `:not(.capability-row-toggle):hover` — hover background via `var(--vscode-list-hoverBackground)`.
- `media/chat.css:2092` — `.capability-row-name` — font-size 12px, font-weight 600, `color: var(--vscode-foreground)`.

### Existing colour variables
- `:root` defines `--neon-cyan: #00d4ff`, `--neon-magenta: #ff4fd8`, `-soft` (30% mix with transparent), `-ink` (55% mix with foreground).
- The top bar, headings, user bubbles, and tool dots all use `color-mix(in srgb, var(--neon-cyan) N%, ...)` for subtle accent application.
- The `.capability-row-name` currently uses plain `var(--vscode-foreground)` — no accent.

### Tests
- `test/webview-helpers.test.ts` — tests `capabilityGroupsView`, `partitionFeatured`, `visibleCapabilityGroups`, etc. Tests assert on `item.label`, `item.name`, `item.invokeLabel`.
- `test/capabilities.dom.test.ts` — DOM tests for the capability browser rendering (both mounts).

## Conventions observed
- CSS accent application: `color-mix(in srgb, var(--neon-cyan) NN%, var(--vscode-*))` — blended, never raw neon.
- Label transforms in the view-model layer (`webview-helpers.js`), not in the renderer (`chat.js`).
- Tests for view-model output live in `test/webview-helpers.test.ts`.

## Supersession
- The existing `label: raw.name || ""` assignment is REPLACED by a conditional transform for `grokbit`-kind items.
- The existing tile border+background CSS is AUGMENTED with an accent, not replaced.
