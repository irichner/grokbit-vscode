# Plan — <title>

Slug: `<slug>` · Approach: <one line> · Blast radius: <N files, N deps, schema y/n>

> Keep the task block format exactly as below. The Grokbit extension and the
> Implement phase parse it.

`cwd:` is optional — omit or write `none` for a single-package repo. In a
monorepo, set it to the package the `verify:` command must run from; a bare
`npm test -- auth.spec.ts` from the repo root fails when the test lives in
`packages/api`. Every `verify:` command must run in the user's actual shell
and OS — don't assume POSIX.

## Tasks

### T1 — <short imperative title>
- **intent:** <what this achieves, one sentence>
- **files:** `path/a.ts`, `path/b.ts`
- **cwd:** <package/dir the verify command runs from, or `none` for repo root>
- **depends:** none
- **verify:** `npm test -- auth.spec.ts`
- **removes:** <files/exports this task deletes, or `none`>
- **baseline:** <existing behavior to characterize BEFORE this task lands, or `none`>
- **rollback:** `git revert <commit>` | <manual steps>
- **state-after:** working
- **notes:** <citations, gotchas from the survey>

### T2 — <...>
- **intent:**
- **files:**
- **cwd:**
- **depends:** T1
- **verify:**
- **removes:**
- **baseline:**
- **rollback:**
- **state-after:** working | breaks-build
- **notes:**

### T6 — Remove legacyResetToken  ← removal tasks are first-class
- **intent:** delete the superseded implementation now that T4 proved the replacement
- **files:** `src/auth/reset.ts`
- **cwd:** none
- **depends:** T4
- **verify:** `rg 'legacyResetToken' src/` returns no matches, AND `npm test` green
- **removes:** `legacyResetToken`, `src/auth/legacy-reset.ts`
- **baseline:** reset flow end-to-end (captured for T4)
- **rollback:** `git revert <commit>`
- **state-after:** working
- **notes:** 3 callers migrated in T4 per `02-survey.md` supersession table

Removal verify proves an ABSENCE: no remaining references, suite still green,
and the behavior that used it still works. A deletion nobody checked is how a
cleanup pass breaks production.

## Verification matrix
Every done-criterion maps to at least one task.

| Done criterion | Proven by |
|---|---|
| <...> | T3 verify |

## Disposition summary
Carried from `03-design.md`. Shown at the approval gate.

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 | T6 |
| DEPRECATE | 1 | T5 — owner <name>, remove by <date> |
| COEXIST | 1 | documented, no task |
| LEAVE | 1 | — |

Net lines: +N / -N. An all-additive plan in a codebase that already does
something adjacent usually means COEXIST was chosen by default without saying so.

## Open assumptions
This is a pointer, not a copy — the full ledger is `assumptions.md`, and
`grokbit-implement`'s Software Engineer reads it before starting a task that
touches one of these. Resolve before or during implementation:

- `UNVERIFIED` <...>
- `UNRESOLVED — <loop>` <...>

## Approval
- [ ] Human approved — <date>
