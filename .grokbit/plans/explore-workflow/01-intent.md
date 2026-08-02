# Intent — Explore workflow in Grokbit Actions

## Problem
Grokbit Actions currently teaches a four-step workflow (plan → implement → test → document). Product language elsewhere already treats **explore** as the first phase of disciplined work—map the code before proposing a change—but there is no Explore tile in Actions and no bundled suite skill for it. Users who want orientation must improvise or rely on built-in agent types that never appear in Grokbit Actions. The gap is product completeness: the menu should present **explore → plan → implement → test → document** as one coherent pipeline.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] After install/rebuild (or suite re-provision), Grokbit Actions shows **five** workflow tiles, with **Explore first**: `grokbit-explore` → `grokbit-plan` → `grokbit-implement` → `grokbit-test` → `grokbit-document` (welcome canvas and top-bar Actions popover).
- [ ] Clicking the Explore tile seeds the composer with `/grokbit-explore ` (or equivalent invoke form) and does **not** auto-send.
- [ ] Invoking Explore on a real question produces a **compact orientation map in chat** (relevant areas, `path:line` citations, unknowns) and does **not** require writing durable files under `.grokbit/` for the skill to “succeed.”
- [ ] Explore is **read-only w.r.t. product source**: it does not implement features or edit application code as part of its procedure (plan artifacts under `.grokbit/plans/` are out of Explore’s job).
- [ ] The skill is a **full suite member**: lives under `resources/skills/grokbit-explore/`, is listed in the suite manifest, is provisioned to `~/.grok/skills` and `~/.claude/skills` with the rest of the suite, and is re-keyed to `kind: "grokbit"`.
- [ ] Suite docs and product copy that still say “four skills” / four-step pipeline are updated to the five-step order.
- [ ] Targeted tests that encode the four-skill featured list / Actions order are updated and green under `npm test`.

## Non-goals
Explicitly out of scope. The Reviewer uses this to catch scope inflation.

- Not a new capability *kind* beyond the existing `"grokbit"` group (no new UI framework for Actions).
- Not restoring Skills / Agents / Commands into the default Actions allowlist.
- Not durable on-disk explore digests (user chose chat map only); not wiring plan Survey to read explore artifacts from disk.
- Not changing plan-mode client gates, permission binding, or ACP protocol.
- Not replacing or renaming the built-in CLI **agent** type `explore` / repo agent `explorer` (different surface from a suite skill).
- Not building a host-side “Explore” button outside Grokbit Actions (no new command chrome).
- Not rewriting `grokbit-plan` to make Explore mandatory before Plan.
- Not Marketplace release procedure / version bump unless the user later asks to rebuild.

## Constraints
- Stack / version limits: VS Code extension TypeScript + webview JS as today; suite skills are Anthropic-format `SKILL.md` trees under `resources/skills/`, portable to Grok Build and Claude Code.
- Must not break: existing four skills’ behavior; provisioning when `grok.skills.provision` is `off`; workspace-fork non-promotion rule for suite names; Actions empty state when suite is absent.
- Deadline or sequencing: Explore is **first** in pipeline teaching order (user decision). Skill depth = full suite skill; product = chat map only (user decision).

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- Name is `grokbit-explore` (matches suite naming: `grokbit-{phase}`).
- Explore may still be invoked mid-session for orientation without starting a plan; it is taught as the first step, not a hard gate on Plan.
- “Chat map only” means no required explore output files; optional chat invitation to run `/grokbit-plan` afterward is allowed.
- Light cross-links in sibling skill README / pipeline diagrams are in scope; deep redesign of plan Survey is not.
- Description frontmatter must be rich enough for discovery (same pattern as other suite skills).

## Questions asked
Max 3, one batch. Record the answers.

1. Q: Where should Explore sit in the Grokbit workflow?  
   → A: **First step** — order becomes explore → plan → implement → test → document; plan may optionally benefit from conversation context (not disk artifacts).

2. Q: What should Explore produce?  
   → A: **Chat map only** — compact orientation in the conversation; no required artifact files.

3. Q: How deep should the Explore skill be?  
   → A: **Full suite skill** — `resources/skills/grokbit-explore` with roles/loops like the other four, provisioned and re-keyed to `kind: "grokbit"`.
