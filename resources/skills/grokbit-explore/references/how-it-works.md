# How Explore works

## Purpose
**Explore** orients you on a part of the codebase **before** you plan a change. It is read-only on files **and** machine state: no edits, no installs, no tests that rewrite snapshots, no plan artifacts under `.grokbit/plans/`. Output is a **chat map** with `path:line` citations — not a substitute for Plan Survey.

Use when you need “what matters here?” and do not yet want a change plan. Skip when you already know the area and are ready for `/grokbit-plan`.

## Pipeline

```
  Scope ──▶ Map (read-only) ──▶ Cite-check ──▶ Present map in chat
  (Scope)     (Cartographer)     (Checker)      (end turn)
```

1. **Scope** — charter: what to find, what is out of bounds, at most one clarifying question.
2. **Map** — open files, cite entities, note connections and unknowns; sample large trees.
3. **Cite-check** — re-open key citations; drop unconfirmed claims.
4. **Present** — structured chat map; invite `/grokbit-plan` if a change is next.

## Roles

| Role | Job |
|---|---|
| **Scope Setter** | Charter only; no exploration yet |
| **Cartographer** | Read-only mapping with citations |
| **Citation Checker** | Spot-check citations; shorten to truth |

## Loops and caps

| Loop | Cap | Exit |
|---|---|---|
| **E1** Scope clarification | 1 question | Charter or stated assumption |
| **E2** Mapping breadth | 3 map passes | Enough for files + contracts + unknowns, or cap with gaps listed |
| **E3** Cite-check | 2 rounds | Every kept claim re-confirmed or moved to unknowns |

Bounding: ~50 caller matches per symbol; sample directories; disclose shortcuts.

## Cap behavior
Hitting a cap means **disclose and present**, not invent more detail. Incomplete honest maps beat sprawling confident ones.

## Artifacts
- **Writes:** none required. No `.grokbit/plans/**`, no digests required for success.
- **Reads:** repo files, greps, lists; optional prior chat.
- **Chat shape:** map template sections (relevant areas, how it fits, contracts, unknowns).

## Human gates
None mandatory. You may steer scope with one answer if asked. Explore never asks you to approve a plan.

## Next step
When you want a change: **`/grokbit-plan <brief>`**. Plan Survey will re-open files and write `02-survey.md`; the chat map is orientation only.

## Provenance
Derived from `resources/skills/grokbit-explore/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**
