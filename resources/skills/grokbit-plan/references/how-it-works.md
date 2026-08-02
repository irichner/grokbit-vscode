# How Plan works

## Purpose
**Plan** turns a request into a grounded, reviewable plan **before any product code is written**. Every claim about the repo must be read from disk (`path:line`) or marked `UNVERIFIED`. Every task must have a runnable `verify:` command. Writes during Plan are limited to `.grokbit/plans/<slug>/`.

Use for non-trivial work (behavior, multi-file, schema, auth). Trivial typos/docs may use a **short plan** still ending in human approval.

## Pipeline

```
  Intake ──▶ Survey ──▶ Design ◀──┐  ──▶ Decompose ◀──┐  ──▶ Approval Gate
  (BA)       (SA)      (Architect)│      (Architect)  │      (human)
                          │       │           │       │
                          └─ Loop 3 ─┘        └─ Loop 4 ─┘
                          Reviewer         Verifiability
```

1. **Intake** → `01-intent.md` (done-criteria, non-goals; ≤3 questions once).
2. **Survey** → `02-survey.md` (entities cited, reuse, supersession, conventions).
3. **Design** → `03-design.md` (≥2 options, disposition table) + adversarial `04-review.md`.
4. **Decompose** → `plan.md` (tasks with verify/baseline/removes/rollback).
5. **Approval gate** — stop; wait for human verdict. **Do not implement in Plan.**

## Roles

| Role | Job |
|---|---|
| **Business Analyst** | Testable intent; max 3 questions |
| **Systems Analyst** | Ground truth with citations |
| **Solutions Architect** | Options, dispositions, task breakdown |
| **Plan Reviewer** | Adversarial design review + one plan-level pass |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **1** Intake clarification | 1 round, 3 questions | Record assumptions; continue |
| **2** Grounding | 3 passes | `UNRESOLVED — Loop 2` in assumptions |
| **3** Adversarial review | 3 rounds | Surviving BLOCKER/MAJOR → assumptions |
| **4** Verifiability | 3 rewrite passes + 1–2 plan review passes | Unfixable tasks split or recorded |

Marker vocabulary: `UNVERIFIED` (assumed fact) vs `UNRESOLVED — <loop>` (loop gave up).

## Cap behavior
In Plan, hitting a cap means **record and continue**. Open questions in `assumptions.md` are visible; a plan with honest unknowns is still useful.

## Artifacts
Under `.grokbit/plans/<slug>/`:

| File | Role |
|---|---|
| `01-intent.md` | Done-criteria, non-goals |
| `02-survey.md` | Cited ground truth |
| `03-design.md` | Options + dispositions |
| `04-review.md` | Append-only findings |
| `plan.md` | Tasks + approval checkbox |
| `assumptions.md` | Open items ledger |

Dispositions for superseded code: `REPLACE` | `DEPRECATE` | `COEXIST` | `LEAVE` (silence is not allowed).

## Human gates
- **Approval** on `plan.md` before Implement (`approved` / `[Plan approved]`).
- Rejected → stay in Plan and revise; cancelled → leave Plan without implementing.
- User edits to `plan.md` are authoritative (offer re-verify if `verify:` changes).

## Next step
After approval: **baseline** via `/grokbit-test` (baseline mode) when any task has non-`none` `baseline:`, then **`/grokbit-implement`**.

## Provenance
Derived from `resources/skills/grokbit-plan/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**
