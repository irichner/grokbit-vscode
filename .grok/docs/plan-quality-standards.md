# Plan Quality Standards

Mandatory reference for plan authors and `gf-plan-reviewer` / **`/plan-review-loop`** (default).
Optional `/cold-review` only when present in `grok inspect` (external plugin — not required).
Plans that fail hard gates must receive **Request Changes** or **Major Concerns** — not Approve.

## Hard gates (must all pass for Approve)

| # | Section | Required content |
|---|---------|------------------|
| 1 | **Goal + acceptance criteria** | Measurable, falsifiable success criteria. Reject vague goals (“make better”, “improve UX”). |
| 2 | **Non-goals** | Explicit out-of-scope list so blast radius stays bounded. |
| 3 | **Risk / blast radius** | Surfaces touched (files/modules/APIs), user impact, data/migration risk, shared-lib risk. |
| 4 | **Ordered steps + per-step verification** | Numbered implementation steps; each step names what changes and how to verify that step (command, assertion, or observable check). |
| 5 | **Testing strategy** | Unit scope + **at least one edge/negative case** per non-trivial behavior; coverage expectation (≥80% when Coverage command is real; else NO COVERAGE TOOL + waiver path). Name suites/paths when known. |
| 6 | **Failure modes** | What can go wrong (partial deploy, bad data, auth miss, rollback). Ship-failure thinking required for production-touching work. |
| 7 | **Observable verification** | Machine- or human-checkable checks. Reject “works correctly” / “should work” / “looks good”. |
| 8 | **UI/UX design** *(conditional)* | Required when the plan touches UI surfaces (views, components, styling, user-facing states); otherwise record **N/A** (counts as pass). Must include: state inventory (empty/loading/error/disabled/focus), design reference (design system, tokens, mockup, or named existing pattern), a11y criteria (keyboard, focus, contrast, labels), and falsifiable design acceptance criteria per `.grok/docs/ui-design-standards.md`. Reject “looks good” / “modern UI”. |

## Soft gates (Request Changes if weak)

- Assumptions listed with falsifiers where material.
- Dependencies and sequencing (what must land first).
- Waiver intent if any gate cannot be met (path under `docs/waivers/`).
- Contract freeze pointer for full-stack parallel work (`docs/plans/<feature>-contract.md`).

## Verdict rules

- **Approve** — all hard gates satisfied (1–7 always; 8 when the plan touches UI, else N/A); residual soft gaps are nits only.
- **Request Changes** — one or more hard gates missing/weak; list Required Changes with severity `gap` / `risk` / `bug`.
- **Major Concerns** — plan is unsafe to implement as-is (unbounded scope, non-observable success, production deploy without gates, invents product where none exists). Prefer this label for unsafe/unbounded plans.

## Loop alignment

- Max **2** plan-review passes (`/plan-review-loop` default; optional `/cold-review` with the same cap when available).
- Between passes: plan must be revised (not re-reviewed unchanged).
- After pass 2, residual **hard-gate failures** (any Overall other than Approve — **Request Changes** or **Major Concerns**) → do **not** implement unless durable waiver under `docs/waivers/`.
- Prefer **Major Concerns** when labeling unsafe/unbounded residual risk for waivers.
- Do **not** start `/implement` or specialist coding until Approve **or** user accepts residual hard-gate failures with durable waiver.
