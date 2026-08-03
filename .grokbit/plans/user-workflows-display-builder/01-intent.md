# Intent — User Workflows display + Workflow Builder (form + visual canvas)

## Problem

Grokbit suite tiles look product-ready (“Explore”, “Plan”, … in cyber green). **User Workflows** still show raw CLI identifiers (`create-workflow`), and creating a workflow is a thin slash seed into a skill. Users need a **real builder UI**: describe a **goal**, shape phases/agents on a **visual canvas** (and/or a **form wizard**), then let the **AI craft** the runnable workflow (agents, phases, script) — not type Rhai by hand.

## Done criteria

Each item must be checkable by a human performing an observable action.

### A — Display parity (User Workflows look like Grokbit Workflows)

- [ ] Grok session: User Workflows **Create** tile shows **“Create Workflow”** (not `create-workflow`) in the same cyber green as suite names.
- [ ] Disk User Workflow tiles show **Title Case** from kebab names (e.g. `review-changes` → **“Review Changes”**), same green.
- [ ] Slash teaching chip stays the real invoke token; `name` remains the identity key.
- [ ] Claude: no fake Create skill tile; empty/help copy stays honest.
- [ ] Suite tiles, featured order, `grok.actionsScope` remain intact.

### B — Workflow Builder UI (form wizard + visual canvas) — **in scope**

- [ ] From **Create Workflow** (Grok), the user opens a **Workflow Builder** surface (not only a bare composer seed).
- [ ] Builder has a **goal-first form**: required goal/outcome; optional name, scope (project vs user), constraints/notes.
- [ ] Builder has a **visual canvas** of the pipeline: phases (and agent slots under phases) the user can add / rename / reorder / remove before craft.
- [ ] **Craft with AI** (primary action) sends a structured brief to the agent so it authors agents/phases/script and saves a runnable workflow (Grok: create-workflow / `.rhai` path). Nothing invents a second runtime in the extension.
- [ ] User can iterate: edit form/canvas → Craft again; busy/locked states are clear; Cancel/close discards or confirms abandon of unsaved builder draft.
- [ ] After a successful craft path, **Refresh** (or auto refresh) can show the new User Workflow tile when the file exists on disk.
- [ ] Canvas technology is recorded in a durable **ADR** (React Flow vs zero-dep vanilla canvas + any bundler cost); implementation matches the ADR decision.
- [ ] Targeted unit + DOM tests for display + builder open/craft seed path; `npm test` green.

## Non-goals

- Extension-hosted **workflow execution engine** (pause/resume/stop dashboard equivalent to CLI `/workflows` run control) — builder authors definitions; CLI runs them.
- **Cross-backend transpile** (Rhai ↔ Claude JS) or claiming one script runs on both.
- **Claude-native create skill** if none exists — Claude may get a limited builder that only helps author a `.js` brief / file path, or Grok-only builder v1 with honest Claude empty state (see assumptions).
- Applying Title Case/green to Skills/Agents/Commands rows.
- Replacing the five Grokbit suite skills.
- n8n/Zapier export, or Marketplace workflow marketplace.

## Constraints

- Thin client: AI + CLI own script truth and runtime; extension owns **intent UI**, draft graph model, and craft handoff (structured seed / prompt; optional host write of a user-approved draft only if design requires).
- Webview today is **vanilla** `media/chat.js` + `tsc` for host only — no React webview bundle yet. React Flow therefore implies **ADR + packaging decision** (new deps and likely a webview bundler).
- Must not break: capability discovery, suite tiles, session tab layout (full-canvas, no `@media`), permission model.
- Windows PowerShell verifies; UI design standards (tokens, a11y, empty/error/disabled).
- Supersedes Business Studio E6 “out of 3.0” deferral **for this product surface** once ADR + this plan are approved (roadmap status should be updated when work starts).

## Assumptions

- Confirmed: suite green + label strip already live; User Workflows still raw kebab; synthetic create tile is Grok-only.
- Inferred: **Builder is Grok-first in v1** (create-workflow skill exists); Claude path may be reduced (brief only) unless implement finds a parallel path.
- Inferred: “Visual canvas” means an editable phase/agent pipeline graph, not a full BPMN tool.
- Inferred: Form wizard + canvas coexist on one builder surface (form for goal/meta; canvas for structure).
- `UNVERIFIED` Whether first canvas ship uses **React Flow** or a **zero-dep vanilla** graph — **ADR decides**; both remain in scope as candidates until ADR lands.
- `UNVERIFIED` Auto-send after Craft vs seed-only (user presses Send) — default **seed structured prompt, user confirms Send** unless product prefers one-click Craft send.

## Questions asked

Product already answered: visual canvas / form wizard / React Flow evaluation are **in scope** (prior plan wrongly excluded them). Remaining for gate if needed:

1. Craft action: **seed only** vs **auto-send** the craft prompt?
2. Claude v1: **Grok-only builder** vs limited Claude form that writes/opens `.claude/workflows` brief?

## Proportionality

`scope: full` — multi-wave feature (display + builder UI + ADR + tests). Larger than display-only; still bounded by thin-client non-goals above.
