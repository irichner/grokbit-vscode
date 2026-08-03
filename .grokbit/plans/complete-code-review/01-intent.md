# Intent — Whole-product code review (Grokbit)

## Problem

The user wants a **complete code review of the whole Grokbit product** — the VS Code extension as shipped and as it sits in the working tree — not only the current uncommitted feature WIP. Grokbit is a multi-backend ACP client (Grok + Claude), with host TypeScript, webview chat/launcher UI, plan-mode enforcement, permission binding, capability discovery, voice, telemetry, and a large grok-free test suite. Before treating the product as ship-ready (including mixed WIP), we need a durable, rubric-ranked product review: what is solid, what is broken or risky, and what must be fixed first.

## Done criteria

Each item must be checkable by a human performing an observable action.

- [ ] **DC1 — Product surface map:** `inventory.md` lists every production surface area (host modules under `src/`, webview `media/*`, packaged resources that affect runtime, CI/test floor) with a risk tier and a named review layer — no production module left “unowned.”
- [ ] **DC2 — Rubric findings file:** `findings.md` ranks issues Critical / Major / Minor / Nit per `.claude/skills/code-review-rubric/SKILL.md`, each with `path:line` (or “N/A — absence”) and a concrete fix.
- [ ] **DC3 — Product ship verdict:** `findings.md` ends with exactly one of **Approve** / **Approve with nits** / **Request changes**, plus the single top priority if not Approve — applying to the **product as a whole**, not one feature.
- [ ] **DC4 — Layer coverage:** Findings (or explicit “reviewed — no Critical/Major”) exist for every layer in the design: Trust/security, ACP+backends, Session/host lifecycle, Plan mode, Capabilities/skills, Webview UI, Peripheral (voice/telemetry/docs/chips/prompt), Test/CI floor.
- [ ] **DC5 — Trust boundaries deep-dived:** Plan-gate, permission-bind, terminal spawn, path containment in capability scan, secret/env handling, and webview postMessage trust assumptions are explicitly reviewed (not only skimmed).
- [ ] **DC6 — Suite + compile evidence:** Full `npm test` and `npm run compile` (or `tsc -p . --noEmit` if that is the project’s typecheck) were run in the review window; pass/fail and counts recorded in `findings.md`.
- [ ] **DC7 — Known-limits honesty:** Documented product limits (from `Claude.md` Known limits / architecture) are either confirmed still true or filed as findings if docs drift from code.
- [ ] **DC8 — Remediation backlog:** Every Critical and Major finding has a next step (fix recommendation). WIP dirty-tree items are included if they affect product quality, not as the sole scope.
- [ ] **DC9 — Sampling disclosed:** Where review used sampling (large files), `findings.md` states what was sampled vs deep-dived so “complete” is honest, not vacuous.

## Non-goals

- Implementing product code fixes in this plan (findings + backlog only; fixes = later implement).
- Auto-commit, tag, rebuild, Marketplace publish, or release.
- Exhaustive line-by-line read of every byte of every historical commit (review **current tree**: HEAD + working tree).
- Re-auditing abandoned branches (`dev`) or archived release notes as primary targets.
- Full live-CLI soak (`npm run test:live` against real grok) as a hard done-criterion — **optional enhancement** if the human expands at the gate (burns credits; not in CI).
- Redesigning the product or adding features.
- Style-only rewrites or dependency upgrades unless a finding requires them.
- Treating prior feature `implement/05-review.md` “Clean” as a product Approve.

## Constraints

- **Stack:** VS Code extension, Node/TypeScript host, plain JS webview, vitest tests; Windows PowerShell for verify commands.
- **Must not break:** Plan/implement of *this* plan only writes under `.grokbit/plans/complete-code-review/`.
- **Proportionality:** Whole product is large (~40 `src/*.ts`, multi-kloc `media/chat.js`, 70+ test files). Review uses **fixed architectural layers** + **mandatory deep-dives on trust boundaries** + **sampling with disclosure** for giant glue files — not unbounded single-file archaeology.
- **Standards:** code-review-rubric priority order; UI standards for webview; AGENTS accuracy gates as reference for what would block a later fix merge.
- **Dirty tree:** Uncommitted WIP is **in scope as elevated risk**, not the outer bound of the review.

## Assumptions

- User rejected WIP-only scope; **whole product** is authoritative (this revision).
- `UNVERIFIED` Outcome remains **findings + product verdict + backlog**, not automatic fixes (same as prior assumption unless user says otherwise).
- “Current product” = files on disk now (committed main + uncommitted changes), reviewed as one system.
- Live grok tests remain optional unless explicitly added at the gate.

## Questions asked

None this revision — user clarified scope: whole product review.