# Intent — Plain-language Grokbit workflow descriptions

## Problem
The five Grokbit workflow tiles (Explore, Plan, Implement, Test, Document) show long, technical frontmatter descriptions full of role names, pipeline jargon, and agent-routing “Use when / Do NOT” prose. Non-technical users open Grokbit Actions and cannot quickly tell what each step *does for them*. Descriptions also exceed the UI display cap, so tiles already clip mid-block.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] In Grokbit Actions (welcome panel or popover), each of the five suite tiles shows a short description a non-technical reader can understand without knowing agent roles, loops, or file layouts.
- [ ] Each description is fully visible without truncation in the Actions row (fits within the existing 260-character webview display cap, and thus within the 280-character host cap).
- [ ] Each description still states, in plain language, what the step *does* and (briefly) when it is for — not a list of internal role titles or artifact path jargon as the primary message.
- [ ] Clicking a tile still seeds the same slash command (`/grokbit-explore`, etc.); no rename of skills or change to the workflow pipeline itself.
- [ ] After a rebuild/re-provision (or local suite re-copy), the new wording appears on both Grok and Claude backends in the Grokbit workflow group.
- [ ] `npm test` stays green, including any test that currently asserts the old long `grokbit-plan` description string.

## Non-goals
- Rewriting skill body prose, pipelines, hard rules, or templates (only the YAML `description:` line users see on tiles, unless a test fixture must track that line).
- Changing skill *names*, order, kind (`grokbit`), or provisioning mechanics.
- Building a second “display-only” description system in TypeScript unless the chosen design requires it (prefer simple frontmatter rewrite if it meets done-criteria).
- Rewriting README/CLAUDE marketing copy except where a one-line note is needed for accuracy.
- Localizing descriptions into other languages.
- Changing CAPABILITY_* character caps or tile layout/CSS.

## Constraints
- Stack / version limits: bundled suite lives under `resources/skills/*/SKILL.md`; extension provisions to `~/.grok/skills` and `~/.claude/skills` on activation/version change.
- Must not break: skill invocable slash forms; suite membership; existing capability discovery; test floor (`npm test`).
- Audience: non-technical / vibe-coder users reading Grokbit Actions.
- Display caps (observed, not redesigned): host `CAPABILITY_DESCRIPTION_MAX_CHARS = 280`; webview `CAPABILITY_ROW_DESCRIPTION_MAX = 260`.

## Assumptions
- `UNVERIFIED` Primary surface is Grokbit Actions tiles, not CLI help screens outside the extension.
- `UNVERIFIED` Slightly weaker agent auto-routing from shorter “when to use” prose is acceptable if slash commands and explicit tile clicks remain clear; skill bodies keep full procedure.
- Inferred: no product rename of the five steps; only copy tone and length change.
- Inferred: provisioned home copies update when the extension re-provisions (version inequality), so shipping via rebuild is the normal path to users seeing new copy.

## Questions asked
None — the request is copy-only and does not change data model or UX structure; length target is fixed by existing display caps.
