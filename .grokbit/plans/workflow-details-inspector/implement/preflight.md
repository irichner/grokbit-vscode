# Preflight — workflow-details-inspector

Run before the first task, 2026-08-03. Observed values, not expectations.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo present, `user.name`/`user.email` set | repo present; `user.name = Israel Richner`, `user.email = israel.richner@gamil.com` | PASS (see note 1) |
| Dirty-tree snapshot | only if entry condition 2 was satisfied dirty; must be restored at Step 6 | tree was dirty with baseline artifacts only; **committed** them as `5404b93` rather than stashed — see note 2. `snapshot: none` | PASS |
| Branch | `main`, synced to `origin/main` | `main` @ `5404b93` (one commit ahead of `origin/main` @ `7d5e5a4`, unpushed by design) | PASS |
| Runtime version | `engines.vscode ^1.94.0`; no `engines.node` declared | node v22.20.0, npm 10.9.3 | PASS |
| Deps installed | lockfile in sync, `node_modules` present | `npm test` + `npx tsc` both run clean, so the tree is installed and coherent | PASS |
| Env vars | none required — CI runs `npm ci && npm test` with no auth, no `grok`/`claude` binary | none needed | PASS |
| Ports free | none required by the suite | n/a | PASS |
| Services up | none — the whole suite is grok-free and network-free | n/a | PASS |
| Clean build | `npx tsc -p . --noEmit` succeeds | clean | PASS |
| Commit policy | skill requires commit-per-task; CLAUDE.md forbids agent commits outside rebuild/release | **user resolved 2026-08-03: commit per task, no push** | PASS (see note 3) |

Single package — not a monorepo. Every task declares `cwd: none`; all verifies run from the repo root.

## Pre-existing test failures

**None.** The suite was fully green before any change.

Suite state at start: **1603 passed, 0 failed, 0 skipped (78 files)**, ~4s.
Baseline suite (`npm run test:baseline`, opt-in): **21 passed, 0 failed (1 file)**.
Typecheck at start: `npx tsc -p . --noEmit` clean.

Any red test from here on is this session's doing.

## Notes

1. **`user.email` is `israel.richner@gamil.com`** — "gamil", not "gmail". Recorded because every commit this session makes will carry it. Pre-existing across the repo's history; not changed here, since git identity is the user's to set and silently rewriting it would be a scope violation.
2. **Why the baseline was committed rather than stashed.** The dirt was entirely this pipeline's own baseline artifacts (`test/workflow-details.baseline.ts`, `vitest.baseline.config.ts`, the `test:baseline` script, the plan directory). `grokbit-test` § Baseline mode requires the baseline be committed before implementation begins, and stashing it would have removed the very instrument the session depends on. Committing satisfied both that requirement and entry condition 2, leaving a genuinely clean tree — so there is no outstanding snapshot to restore at Step 6.
3. **Active pre-commit hook.** Every commit runs the agentic-template hook that patch-bumps `VERSION` and rewrites the commit-token ledger (`0.1.28 → 0.1.29` on the baseline commit). Expect ~11 further bumps, one per task commit. This is that harness working as designed and is independent of the extension's own CalVer in `package.json`; it is recorded here so the churn is not later mistaken for stray diff noise. The hook also warns `no measured tokens provided` on each commit — expected, not an error.

## Blocked

None.
