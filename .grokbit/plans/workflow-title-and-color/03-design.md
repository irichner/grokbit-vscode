# Design — workflow-title-and-color

## Approach A: View-model label transform + CSS border accent (chosen)

### Label transform
Add a pure helper `workflowDisplayLabel(name, kind)` in `capabilityGroupsView`'s item mapping. When `kind === "grokbit"` and `name` starts with `"grokbit-"`, strip the prefix and capitalize the first letter. Otherwise return the name unchanged.

Example: `"grokbit-explore"` → `"Explore"`, `"grokbit-plan"` → `"Plan"`, `"grokbit-implement"` → `"Implement"`.

The `name` field stays untouched (it's the identity key used by `partitionFeatured`, `CAPABILITY_FEATURED`, `SUITE_SKILL_NAMES_LC`, and the `dedupeByPriority` dedup). Only `label` (the display string) changes. The `invokeLabel` also stays unchanged — it still shows `/grokbit-explore`.

### CSS accent
Add a faint neon-cyan left border to `.capability-row:not(.capability-row-toggle)` tiles, using the same `color-mix` idiom the rest of the UI uses. This is the lightest possible change that makes tiles look distinguished:

```css
border-left: 2px solid color-mix(in srgb, var(--neon-cyan) 45%, var(--vscode-editorWidget-border));
```

This mirrors the `.subagent-card` pattern (`border-left: 2px solid var(--vscode-charts-purple)`) but uses the existing cyberpunk cyan.

### Why this approach
- The label transform is a one-line addition in the existing `capabilityGroupsView` item-mapping loop — no new function needed, no new module.
- The CSS change is two properties on an existing selector — no new class, no new selector.
- Both changes are scoped to `grokbit`-kind items only (the label by `kind` check, the CSS by the existing `.capability-row:not(.capability-row-toggle)` selector which already targets only workflow tiles).

## Approach B: Host-side label transform in `src/capabilities.ts` (rejected)

Could transform the name before it leaves the host (in `capabilityFromSkillFile` or `applySuiteKind`). Rejected because:
- The `name` field is the identity key in multiple systems (`partitionFeatured`, `CAPABILITY_FEATURED`, `dedupeByPriority`). Changing it breaks all of them.
- Adding a separate `displayName` field to `CapabilityItem` means changing the TypeScript interface, the merge logic, and every consumer — overkill for a display-only concern.
- The view-model layer (`capabilityGroupsView`) already owns the `label` field as a display concept distinct from `name`.

## Disposition
| Item | Disposition | Reason |
|---|---|---|
| `label: raw.name \|\| ""` in `capabilityGroupsView` | REPLACE | New conditional: strip prefix + capitalize for grokbit kind |
| `.capability-row:not(.capability-row-toggle)` border CSS | AUGMENT | Add left accent border; keep existing border/background |
| Existing tests for `capabilityGroupsView` labels | AUGMENT | Add assertions for the new label transform |
