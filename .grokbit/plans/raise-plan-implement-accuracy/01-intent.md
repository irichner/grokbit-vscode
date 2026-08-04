# Intent — Raise plan/implement accuracy (operational gates + dual-pipeline clarity)

## Problem
Planning and implementation accuracy already have rich *policy* (hard gates, accuracy protocol, suite verify-or-revert), but several **operational** switches are off or ambiguous: Project Test Commands list Coverage and Lint as NONE, so QA/hooks cannot enforce those gates; an open coverage waiver documents the gap; and two parallel workflows (GrokForge `/plan`+`/implement` vs Grokbit suite) are easy to confuse, which weakens consistent use of the accuracy stack.

## Done criteria
Each item must be checkable by a human performing an observable action.

- [ ] `AGENTS.md` Project Test Commands list a **real** backtick-wrapped **Lint** command (not `NONE`/`TODO`) that exits 0 on a clean tree and fails on deliberate type errors.
- [ ] `AGENTS.md` Project Test Commands list a **real** backtick-wrapped **Coverage** command (not `NONE`) that runs and prints coverage numbers for this repo’s vitest suite.
- [ ] `package.json` declares the coverage tooling dependency and a `test:coverage` (or equivalent) script; `vitest.config.ts` enables coverage for `src/**` (or documented include).
- [ ] `docs/waivers/coverage-no-tool.md` is retired or rewritten so it no longer claims “no coverage tool” while tooling is live (expiry condition met).
- [ ] A durable dual-pipeline section exists (in `docs/grokbit-workflows.md` and/or `docs/WORKFLOW.md`) that states when to use **Grokbit suite** vs **GrokForge `/plan`+`/implement`**, and that chat-only plans are not implementable under either path.
- [ ] `npm test` remains green after the change; `npx tsc -p . --noEmit` remains clean.
- [ ] With hooks provisioned and trusted, a session that changes a file runs the new Lint command on Stop (observable: Stop gate no longer skips Lint solely because the row was NONE).

## Non-goals
- Reimplementing plan-quality, test-accuracy, or coverage **policy** inside TypeScript/ACP (explicitly rejected in `docs/plans/client-gates-and-cross-backend-review.md`).
- Expanding the Stop hook to run Coverage or full accuracy protocol (hooks stay Lint+Unit backstop per `resources/hooks/grok/verify_on_stop.py`).
- Adding ESLint/Prettier unless already present (they are not).
- Merging GrokForge and Grokbit suite into one skill tree or rewriting persona files wholesale.
- Changing product chat UI, ACP client behavior, or Marketplace packaging beyond incidental script/docs for this accuracy work.
- Forcing ≥80% **changed-line** coverage with diff-cover in v1 if the only reliable measure is whole-package vitest coverage (document ladder rung honestly).
- Unblocking unrelated handoff work (`workflow-details-inspector` T7–T10).

## Constraints
- Stack / version limits: Node + vitest `^2.1.9` (`package.json`); Windows-native verify commands preferred.
- Must not break: existing `npm test` suite; hook PTC parser tests that use **fixture** AGENTS strings (not live `AGENTS.md`).
- Must not invent secrets or weaken test assertions to green coverage/lint.
- Sequencing: measure coverage baseline **before** adding a hard `fail_under` threshold that could brick CI/hooks.

## Assumptions
Decided rather than asked. Each is a candidate finding for the Reviewer.

- `UNVERIFIED` “These changes” means the explore map’s levers: operationalize Coverage+Lint, clarify dual pipeline — not unrelated open plans.
- `UNVERIFIED` Lint = `npx tsc -p . --noEmit` (already release gate in `scripts/release.ps1` / CLAUDE.md) is the right Lint command without adding ESLint.
- `UNVERIFIED` Coverage provider = `@vitest/coverage-v8` as named in `docs/waivers/coverage-no-tool.md` follow-up.
- `UNVERIFIED` Dual-pipeline clarity is docs-only (no product UI change) for this slug.
- `UNVERIFIED` Whole-package coverage % may be below 80% today; v1 must not set a failing `fail_under` until baseline is measured (or only document the gate for QA manual reading).

## Questions asked
None — answers inferred from explore map + waiver follow-up + release scripts. Material product choices recorded as assumptions above.
