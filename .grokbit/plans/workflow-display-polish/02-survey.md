# Survey — Workflow Display Polish

## Entities

### Label generation — `capabilityGroupsView` in `media/webview-helpers.js`

The view-model builder sets `label: raw.name || ""` for every item
(`media/webview-helpers.js:830`). This is the text rendered as the row's
primary name. `name` is preserved separately and is the key for all
matching logic (`partitionFeatured`, `markLocalSuiteOverrides`,
`CAPABILITY_FEATURED`, `SUITE_SKILL_NAMES_LC`).

### Label rendering — `buildCapabilityRow` in `media/chat.js`

`buildCapabilityRow` (`media/chat.js:~847 offset`) creates a
`.capability-row-name` span and sets `name.textContent = item.label`.
It also creates `.capability-row-cmd` from `item.invokeLabel` when
present. The function does NOT branch on `item.kind` — it branches on
`item.control` (for toggle rows) and `item.action` (for click behavior).

### CSS — `.capability-row-name` in `media/chat.css:2093`

Current rule:
```css
.capability-row-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--vscode-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```
No kind-specific color today. No `data-kind` attribute on the row.

### Matching surfaces that use `item.name` (NOT `item.label`)

1. `partitionFeatured` — `media/webview-helpers.js:762` — matches
   `(item.name || "").toLowerCase()` against `CAPABILITY_FEATURED[kind]`.
2. `markLocalSuiteOverrides` — `media/webview-helpers.js:~710` — matches
   `(item.name || "").toLowerCase()` against `SUITE_SKILL_NAMES_LC`.
3. `CAPABILITY_FEATURED.grokbit` — `media/webview-helpers.js:680` —
   `["grokbit-explore", "grokbit-plan", ...]`.
4. `SUITE_SKILL_NAMES_LC` — `media/webview-helpers.js:700` — same list.

All four use `item.name`, never `item.label`. Changing `label` cannot
break them.

### Skill files on disk — `resources/skills/grokbit-*/SKILL.md`

Each carries `name: grokbit-explore` (etc.) in frontmatter. The host's
`capabilityFromSkillFile` (`src/capabilities.ts`) reads this into the
`CapabilityItem.name` field. Not changed by this work.

### Invoke strings

`item.invoke` comes from `raw.invoke` (e.g. `"/grokbit-explore "`).
`item.invokeLabel` is `invoke.trim()` (e.g. `"/grokbit-explore"`).
Neither is derived from `label`. Not affected.

## Conventions observed

- The codebase already has `--neon-cyan` and `--neon-magenta` as custom
  properties on `:root` in `chat.css:4-6`, plus `*-ink` and `*-soft`
  blended variants. A `--neon-green` follows the same pattern.
- The renderer rule "never branch on kind strings" is stated in
  `capabilityGroupsView`'s JSDoc and enforced in code reviews. The CSS
  hook must be a data attribute stamped by the view-model, not a JS
  branch in `buildCapabilityRow`.

## Supersession

Nothing is superseded — this adds a display transform and a CSS accent.
No dead code is created.

## Tests that will need updating

- `test/webview-helpers.test.ts` — `capabilityGroupsView` tests that
  assert `label` values for grokbit items (currently expect the raw
  name).
- `test/capabilities.dom.test.ts` — DOM tests that assert
  `.capability-row-name` textContent (currently expect `"grokbit-explore"`
  etc.; line 111).
