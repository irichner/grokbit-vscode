# Design — Raise plan/implement accuracy

## Options considered

### Option A — Operational gates + dual-pipeline docs (tooling-first)
Approach: Add `@vitest/coverage-v8` and a `test:coverage` script; enable coverage in `vitest.config.ts` without an immediate hard global fail that bricks the suite; set **Lint** in `AGENTS.md` to `npx tsc -p . --noEmit` (existing release check); set **Coverage** to the new npm script; optionally set **Build** to `npm run compile`; retire/update `coverage-no-tool` waiver; add a short when-to-use matrix for Grokbit suite vs GrokForge `/plan`+`/implement` in product docs. Leave Stop hook scope as Lint+Unit only (no Coverage in Stop). Leave accuracy skills as SoT.

Trade-off (against the intent's constraints): Directly closes the explore gap (gates that cannot fire). Low product-code risk. Does not make “agents always follow protocol” automatic — still soft for plan quality / test accuracy. Coverage may remain whole-package rung until a changed-line tool lands.

### Option B — Skill/protocol rewrite only (docs-and-discipline)
Approach: Tighten `.grok/skills/plan|implement` and suite skills with more mandatory checklists; keep Coverage/Lint as NONE; expand waiver culture.

Trade-off: Zero new dependencies; does **not** meet done-criteria for real Lint/Coverage commands or Stop picking up Lint. Leaves residual risk named in the existing waiver unfixed.

### Option C — Client-side accuracy engine
Approach: Encode plan-quality / coverage ladder / accuracy protocol in the VS Code extension (TypeScript).

Trade-off: Explicitly a non-goal in `docs/plans/client-gates-and-cross-backend-review.md:28-30`. Large blast radius; wrong layer for skill-owned protocol.

## Decision
**Chosen: A**

Rationale against constraints: Matches waiver follow-up (`docs/waivers/coverage-no-tool.md:9`), reuses release typecheck as Lint, activates existing Stop PTC parser without redesigning hooks, and clarifies dual pipeline without merging skill trees. Rejects C by prior product decision; rejects B as insufficient for stated done-criteria.

What the rejected option was better at:
- **B** better at avoiding install churn and dependency risk.
- **C** better at mechanical enforcement independent of agent compliance — deferred to client-gates roadmap for *other* gaps (e.g. protect-path floor), not for rehosting accuracy protocol.

## Shape of the change

```
  package.json (+ @vitest/coverage-v8, test:coverage)
       │
       ▼
  vitest.config.ts (coverage provider + include)
       │
       ▼
  measure baseline (report only; no fail_under unless already ≥80% and intentional)
       │
       ▼
  AGENTS.md Project Test Commands
       Lint → `npx tsc -p . --noEmit`
       Coverage → `npm run test:coverage`
       Build → `npm run compile` (optional fill of TODO)
       │
       ├─▶ docs/waivers/coverage-no-tool.md retired/superseded
       ├─▶ docs dual-pipeline when-to-use (WORKFLOW + grokbit-workflows)
       └─▶ Stop hook (no code change) now runs Lint + Unit when files changed
```

Coverage gate honesty (`.grok/docs/coverage-policy.md`):
- v1 primary measure: **whole-package** vitest coverage (rung 3) recorded in QA reports.
- Changed-line (rung 1) remains preferred when tooling exists later; do not claim changed-line % without a tool.
- If baseline whole-package is &lt;80%, do **not** set vitest thresholds that fail `test:coverage` until a separate decision/task; the Coverage command still “exists” for measurement and ends the NO TOOL path.

Lint:
- Map to `npx tsc -p . --noEmit` so Stop + accuracy targeted loop both get a real static check (same as release).

Dual pipeline matrix (docs content):

| Need | Use |
|---|---|
| Portable suite artifacts under `.grokbit/plans/`, verify-or-revert, SHIP verdict | Grokbit Actions: explore → plan → approve → test/implement |
| GrokForge personas, `docs/plans/*.md` hard gates 1–8, accuracy protocol with gf-qa | Template `/plan` then `/implement` |
| Never | Implement from chat-only plan (both paths) |

## Disposition of superseded code
Every item from the survey's supersession section.

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Coverage `NONE` row | REPLACE | Real Coverage command required by intent | Update `AGENTS.md` Coverage row to runnable script |
| Lint `NONE` row | REPLACE | Real Lint required by intent | Update `AGENTS.md` Lint row to tsc noEmit |
| `docs/waivers/coverage-no-tool.md` “no tooling” | REPLACE | Waiver expiry condition is tooling + REAL command | Rewrite as historical / delete and point from README if needed |
| Dual-pipeline ambiguity | COEXIST (documented) | Both systems remain intentional; not merging | Document when-to-use; no deletion of either skill tree |

## Unhappy paths
| Scenario | Behavior |
|---|---|
| Coverage install fails on Windows | Stop; do not claim Coverage REAL; keep waiver |
| Whole-package coverage &lt; 80% | Ship measurement command without fail_under; document rung + residual risk in waiver replacement note or coverage note |
| `tsc --noEmit` already red before change | Preflight/blocker — fix or waive Lint enablement; do not enable failing Lint on Stop blindly |
| Dual-stack hooks double-run tests+tsc | Expected known limit; docs note cost increase; do not “fix” by removing Claude hooks |
| Agent edits AGENTS to NONE again | protect_paths already protects AGENTS when hooks trusted |

## Migration
Schema change: no  
Reversible: yes (revert package.json / vitest config / AGENTS rows / restore waiver)  
Existing rows: N/A  
Mixed-version window: local hooks under `.grok/hooks` may lag `resources/hooks` until re-provision; **AGENTS is the command source** — provisioning not required for QA to use Coverage command.

## New dependencies
| Package | Why nothing in-repo suffices | Size | License |
|---|---|---|---|
| `@vitest/coverage-v8` | No coverage provider installed; waiver names this package | moderate (V8 coverage) | MIT (vitest ecosystem; confirm at install) |
