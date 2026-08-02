# Design — Workflow Display Polish

## Approach A — View-model label transform + CSS data-kind attribute

**Label stripping:** In `capabilityGroupsView`, when building each item,
check if `raw.kind === "grokbit"` and the name starts with `"grokbit-"`.
If so, set `label` to the remainder, capitalized (e.g. `"grokbit-explore"`
→ `"Explore"`). `name` stays the raw value for all matching logic.

**CSS hook:** The view-model already stamps `kind` on each item. In
`buildCapabilityRow` (`chat.js`), add `row.dataset.kind = item.kind` to
the `.capability-row` element. This is a data attribute, not a JS branch
on kind — the renderer still handles every kind identically in its logic;
the attribute is purely for CSS targeting.

**Cyber green color:** Add `--neon-green: #39ff14` (or similar) and a
blended `--neon-green-ink` to `:root` in `chat.css`, following the
established `--neon-cyan`/`--neon-magenta` pattern. Then:
```css
.capability-row[data-kind="grokbit"] .capability-row-name {
  color: var(--neon-green-ink);
}
```

**Pros:** Minimal change surface. Label transform is in the pure
view-model (testable). CSS targeting via data attribute respects the
no-branch-on-kind rule. The `*-ink` blending pattern ensures contrast in
light themes.

**Cons:** Adds a data attribute to every capability row, not just grokbit
ones. (Harmless — it's one string assignment per row, and other kinds may
want per-kind styling later.)

## Approach B — CSS class on the row instead of data attribute

Same label transform. Instead of `data-kind`, add a CSS class like
`.capability-kind-grokbit` when `item.kind === "grokbit"`.

**Pros:** Slightly more conventional CSS targeting.

**Cons:** The class name embeds the kind string, which is closer to
"branching on kind" in spirit. If new kinds arrive, each needs a new
class. The data attribute is more generic.

## Decision

**Approach A.** The data attribute is the lighter-weight, more
future-proof hook. It follows the codebase's existing `dataset.*` usage
(e.g. `item.dataset.toolCategory` in `addToToolGroup`). The `*-ink`
blend for the green accent follows the exact same pattern as the
existing cyan and magenta accents.

## Supersession dispositions

| Item | Disposition | Reason |
|------|-------------|--------|
| Current `.capability-row-name` color rule | REPLACE | Overridden for `data-kind="grokbit"` rows only; the base rule stays for all other kinds |

## Color choice

`#39ff14` is a classic "matrix green" / cyber green. Blended with
foreground via `color-mix` at 55% (same ratio as `--neon-cyan-ink`) it
reads well on both dark and light VS Code themes.
