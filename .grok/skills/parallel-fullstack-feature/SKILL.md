---
name: parallel-fullstack-feature
description: >
  Parallel backend/frontend in worktrees with contract-first integration and
  post-change accuracy protocol. Use for full-stack features or /parallel-fullstack-feature.
disable-model-invocation: true
---

# Skill: Parallel Full-Stack Feature

## Prerequisites

- **Git repository required.** If no git: stop and recommend sequential `/implement` or single-tree work.
- Lead-only spawns (depth 1) throughout.

## Contract artifact (required before parallel work)

Write `docs/plans/<feature>-contract.md` (or section in the plan) containing:

- Endpoints / events / shared types
- Owner for shared types (backend | frontend | package path)
- Error and auth expectations
- **UI contract** (when frontend in scope): key screens/components, state inventory (empty/loading/error/disabled/focus), design tokens + breakpoints, a11y — per `.grok/docs/ui-design-standards.md`
- Freeze stamp (date + “no divergent fields without re-freeze”)

## Steps

1. Plan Mode + plan critique (**`/plan-review-loop` default**; optional `/cold-review` only if listed in `grok inspect`). Max 2 review passes. Freeze contract artifact.
2. Prefer `/implement` for sequential high-rigor work when parallelism is unnecessary.
3. If parallel: spawn `gf-backend` and `gf-frontend` with `isolation: worktree`, **prepend** persona instructions, tags `[gf-backend]` / `[gf-frontend]`, `capability_mode: all`. Each specialist follows Done criteria (green targeted tests when shell available). Capture each child’s **worktree path** from the spawn result.
4. **Integrate** (required before protocol) — use the first method that works in this environment:
   1. **ACP / IDE worktree apply** when available (`x.ai/git/worktree/apply` or equivalent UI action) for each child worktree into the main working tree.
   2. **CLI fallback (default for pure Grok CLI):** from the **main** repo worktree (not a child):
      - Inspect: `git worktree list` and each child’s status/diff.
      - Bring changes into the main tree via an explicit, reviewed merge path, e.g. checkout files from the worktree branch, `git merge` of the worktree branch, or patch apply — **no force-push, no `reset --hard` of shared branches** without user confirmation.
      - Resolve conflicts in the main tree; re-read the contract artifact for drift.
      - Remove temporary worktrees only after integration is verified (`git worktree remove` when safe).
   3. If neither path is possible: **stop** — do not claim parallel integration done; fall back to sequential work on main.
5. Run **`/post-change-accuracy-protocol`** on the **integrated** main tree (targeted → review → regression → UI verification when UI changed → check-work; max 3 protocol cycles).
6. Record token/model usage for the session in `docs/metrics/token-ledger.md` when figures are known.

## Failure

- Divergent contracts (fields/types not in freeze doc) → stop and re-freeze.  
- Partial integration → **NO-GO** until protocol passes on the integrated tree.  
- Unintegrated worktrees left as the only copy of changes → **NO-GO**.
