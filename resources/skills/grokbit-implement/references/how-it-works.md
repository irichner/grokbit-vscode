# How Implement works

## Purpose
**Implement** builds an **approved** plan one task at a time. Each task either passes its `verify:` command or is **reverted to clean** — no half-finished debris. The plan is the scope; undeclared files and opportunistic cleanup are deviations.

## Pipeline

```
 Preflight ──▶ ┌─ per task ──────────────────────────────┐ ──▶ Handoff
 (Build Eng)   │  Write ──▶ Verify ◀─┐   ──▶ Scope audit │      to testing
               │  (SWE)     (I2 ×3)  │       (Reviewer)  │
               │     └── Dep gate ───┘       (I3 ×2)     │
               └──────────────────────────────────────────┘
    deviations ≥ 3 ──▶ back to grokbit-plan (max 2 replans)
```

1. **Preflight** — git, deps, env, suite state; dirty-tree snapshot if needed.
2. **Per task** — write → verify (retry ≤3) → scope audit → commit (when host allows).
3. **Dependency gate** — new packages require approval/rejection loop.
4. **Deviation count** — three counting deviations → re-plan from Survey.
5. **Handoff** → `implement/handoff.md` + invoke Test verify mode.
6. **Hand-back intake** — on Test `DO NOT SHIP` for REGRESSION/CRITICAL, append fix tasks (max 2 cycles).

## Roles

| Role | Job |
|---|---|
| **Build Engineer** | Preflight environment |
| **Software Engineer** | Task write/verify/revert |
| **Supply Chain Security Analyst** | Dependency gate |
| **Code Reviewer** | Scope audit (in/out of scope hunks) |
| **Orchestrator** | Counts deviations; enforces re-plan cap |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **I1** Preflight repair | 2 per check | Stop — do not code in broken env |
| **I2** Task execution | 3 attempts | Revert to clean; mark `blocked` |
| **I3** Scope audit | 2 rounds | Revert contested hunks or promote task |
| **I4** Dependency gate | 2 rejections | Ask human |
| **I5** Deviation escalation | 3 counting deviations | Stop; re-plan (max 2 replans per slug) |

**Revert to clean** = restore modified tracked files **and** delete files the task created (git checkout alone is not enough).

## Cap behavior
Unlike Plan, hitting implement caps means **revert**, not “record and leave broken code.” A blocked task in `progress.md` is better than a silent hollow green.

## Artifacts
Under `.grokbit/plans/<slug>/implement/`:

| File | Role |
|---|---|
| `preflight.md` | Env + pre-existing failures |
| `progress.md` | Task ledger (session memory) |
| `05-review.md` | Scope audit |
| `deviations.md` | Plan vs reality |
| `handoff.md` | Contract for Test |

Also updates top-level `.grokbit/handoff.md` for the next Plan session.

## Human gates
- Plan must already be approved.
- Dependency installs may need human choice after two rejections.
- Promoted out-of-scope tasks and Test hand-back tasks need a one-line yes.
- Dirty-tree proceed and baseline waiver are explicit user choices when used.

## Next step
**`/grokbit-test`** in verify mode (after baseline exists or reduced mode is stated). On `DO NOT SHIP`, Implement may take hand-back fix tasks.

## Provenance
Derived from `resources/skills/grokbit-implement/SKILL.md` and `references/loops.md` / `roles.md`. **Agent procedure remains `SKILL.md`.**
