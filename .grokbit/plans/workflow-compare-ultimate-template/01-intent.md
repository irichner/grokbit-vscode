# Intent — Three-way workflow comparison → enhance Grokbit extension

**Revision:** 2026-08-03 — scope expanded: three systems; goal is **product enhancement of the Grokbit VS Code extension**, not a pure “which is better” taste test.

## Problem

We need a grounded comparison of three agentic workflow systems, then a **prioritized plan for improving Grokbit extension capabilities** by adopting (or deliberately rejecting) the best ideas from each:

1. **Grokbit.ai today** — product suite (`resources/skills/grokbit-*`) + project agentic team (`.grok/skills/plan|implement`) + extension host (Actions, dual backend, workflow builder, skill provision).
2. **Claude Code Ultimate Template** — `C:\Users\israe\Projects\claude-code-ultimate-template` (Claude-only six surfaces + bash Stop hooks + `/ship`).
3. **GrokForge Agentic Dev Team Template** — `C:\Users\israe\Projects\grokbuild-dev-team-template` (Grok-primary `/plan`+`/implement`, Python `.grok/hooks/` Stop gate, dual-stack ADR, installer).

## Done criteria

- [ ] Survey covers all three systems with `path:line` (or dir listing) citations from this session.
- [ ] Survey states what Grokbit **already** has vs template (especially: hooks present/absent; plan/implement skill parity).
- [ ] Design scores the three on shared axes **and** maps each winning idea to an **extension surface** (provision, Actions UI, ACP/session, settings, dogfood-only).
- [ ] Design chooses a prioritized enhancement approach (≥2 options) with dispositions for overlap/duplication.
- [ ] `plan.md` lists implementable tasks for the **extension** (or dogfood harness that the extension can later productize), each with a runnable `verify:` on Windows.
- [ ] Non-goals keep scope out of rewriting third-party template repos or full suite redesign unless required by a task.
- [ ] Human can approve a clear ordered roadmap at the gate.

## Non-goals

- Editing Ultimate or GrokForge template repos as the deliverable.
- Full rewrite of the five `grokbit-*` skills in this plan’s first wave (unless a task is a thin bridge).
- Empirical multi-day A/B of token cost / bug rates.
- Marketplace marketing copy as a deliverable.
- Making Grokbit Claude-only or Grok-only (dual backend is product identity).

## Constraints

- Prefer changes that fit thin-client architecture (`Claude.md` / ACP surfaces).
- Windows-first where hooks/scripts matter (dev-team template already chose Python for this).
- Must not break existing suite provision, dual-backend sessions, or `npm test` floor.
- Analysis + plan only until approval; then `/implement` (or suite implement) on approved tasks.

## Assumptions

- `UNVERIFIED` Operator priority: **extension product leverage** > dogfooding this monorepo alone (dogfood can be a stepping stone to product features).
- `UNVERIFIED` “Extension capabilities” includes: hosted skills/workflows UX, provisioning, session gates visibility, dual-backend correctness, and optional install of harness pieces into the open workspace.
- Grokbit’s project `plan`/`implement` skills match the GrokForge template byte-for-byte on implement (hash-checked this session) — treat them as the same lineage unless diverged later.

## Questions asked

None in this revision — goal restated by user (“enhance grokbit extension capabilities” + third path).
