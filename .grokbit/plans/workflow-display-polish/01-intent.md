# Intent — Workflow Display Polish

## Problem

The Grokbit Actions panel shows workflow items with their raw skill names
(`grokbit-explore`, `grokbit-plan`, etc.). The `grokbit-` prefix is an
internal namespace, not a user-facing label. Displaying it makes the UI
look like a developer tool rather than a polished product. Additionally,
the workflow name titles use the standard foreground color — they should
stand out with a cyber green accent to reinforce the Grokbit identity.

## Done-criteria

- [ ] Each workflow tile in the Actions panel displays the name WITHOUT
      the `grokbit-` prefix (e.g. "Explore", "Plan", "Implement", "Test",
      "Document") — capitalized.
- [ ] The `/grokbit-explore` slash-command chip beside the name is
      unchanged (it must still show the full invoke token).
- [ ] The workflow name titles render in a cyber green color
      (a new `--neon-green` CSS variable).
- [ ] Featured-set matching, local-override detection, and invoke strings
      are all unaffected (they key on `item.name`, not `item.label`).
- [ ] Existing tests are updated and all pass.

## Non-goals

- Changing the skill file names on disk or their frontmatter `name:` field.
- Changing invoke strings or slash-autocomplete behavior.
- Applying the green color to non-grokbit capability rows.
- Renaming the group heading ("Grokbit workflow" stays as-is, or could
  become "Grokbit Actions" — already the heading the panel uses).

## Constraints

- The renderer (`buildCapabilityRow` in `chat.js`) must not branch on
  `item.kind` — that is a standing architectural rule. The CSS hook must
  use a data attribute or class.
- The `label` field is display-only; `name` is the matching key. Only
  `label` changes.
