# Intent — User Workflows under Grokbit Workflows (Grok + Claude)

## Problem

Grokbit Workflows already shows the five bundled pipeline tiles (Explore → Plan → Implement → Test → Document). Both agent backends now support **saved multi-agent workflows** on disk — Grok as Rhai under `.grok/workflows/`, Claude Code as JavaScript under `.claude/workflows/` — but the extension never surfaces those as launchable tiles. Users cannot browse or start their own workflows from the same place they start the Grokbit suite, on either backend.

## Done criteria

Each item must be checkable by a human performing an observable action.

- [ ] On a **Grok** session tab, Grokbit Workflows surfaces a **User Workflows** section with one tile per valid discovered project/user **`.rhai`** workflow (or an honest empty-state when none).
- [ ] On a **Claude** session tab, Grokbit Workflows surfaces a **User Workflows** section with one tile per valid discovered project/user **Claude workflow script** under `.claude/workflows/` (or an honest empty-state when none) — **not** a permanent “Grok only” dead end.
- [ ] Each discovered workflow appears as its own tile (name + description), same tile chrome as suite skills.
- [ ] Clicking a tile seeds the composer with a **backend-appropriate** launch command (nothing auto-sends).
- [ ] A Grok tab never lists Claude’s `.js` workflows as if they were Grok Rhai (and vice versa) — discovery is backend-scoped.
- [ ] Reference-only / non-workflow files (e.g. repo template `.md` under `.grok/workflows/`) are not listed.
- [ ] Existing suite tiles, Refresh, lock-during-busy, and `grok.actionsScope` behaviour for skills/agents/commands remain intact.
- [ ] Targeted unit + DOM tests cover both backends’ discovery, parsers, visibility, and empty states; `npm test` stays green.

## Non-goals

- Building an in-extension **run dashboard** equivalent to CLI `/workflows` (pause/resume/stop UI) for either backend.
- Executing or validating Rhai/JS inside the extension host (each CLI owns its workflow runtime).
- **Transpiling or sharing one script file across backends** — formats differ; dual *support* means discover + launch each backend’s native files, not one file that runs on both.
- Surfacing ephemeral per-session run artifacts (e.g. old `wf_*.json` session dumps) as “saved workflows.”
- MCP / personas / plugins browsers.
- Changing the bundled five-skill suite membership or order.
- Auto-sending when a tile is clicked.
- Teaching authors how to write workflows (beyond empty-state pointer to create/save paths).

## Constraints

- Stack: VS Code extension webview + pure host discovery (`src/capabilities.ts`), same pattern as skills/agents.
- Must not break: suite tiles, `visibleCapabilityGroups` / `actionsScope`, capability DOM tests, thin-client rule (only real, launchable CLI capabilities).
- Authority for paths:
  - Grok: `~/.grok/docs/user-guide/05-configuration.md` — project/user `.grok/workflows/*.rhai`
  - Claude: Claude Code changelog + observed real scripts (e.g. `.claude/workflows/*.js` with `export const meta = { name, description, … }`)
- Windows + PowerShell verify commands; single-package repo.
- No new npm dependencies.

## Assumptions

- `UNVERIFIED` Grok invoke default: `/workflow <name> ` (trailing space). Bare `/name` also works in CLI.
- `UNVERIFIED` Claude invoke default: `/workflow <name> ` or `/<name> ` — confirm against live Claude slash/ACP commands during implement if tests/docs disagree; prefer the form that appears in ACP `available_commands` when present.
- `UNVERIFIED` Claude saved scripts are primarily **`.js`** under project + user `.claude/workflows/` (confirmed one real project file); also accept **`.ts`** if present with same meta shape, or document skip if implement finds only `.js` is loaded by the CLI.
- `UNVERIFIED` User home Claude path is `~/.claude/workflows/` (changelog references it / `CLAUDE_CONFIG_DIR`); project is workspace-relative `.claude/workflows/`.
- Empty-state copy is backend-specific (how to create for *this* CLI), not “workflows impossible on Claude.”

## Questions asked (prior batch)

1. Q: What should “User Workflows” mean? → A: **Group of tiles, one per saved workflow.**
2. Q: Claude tab behaviour? → A: Was “Grok only message” — **superseded by this revision:** user wants workflows designed to work on **both** Grok and Claude.

## Revision note

Product direction update (session): dual-backend native discovery/launch, not Grok-only with a Claude dead-end.