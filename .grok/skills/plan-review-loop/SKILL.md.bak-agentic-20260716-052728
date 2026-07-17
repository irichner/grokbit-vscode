---
name: plan-review-loop
description: >
  Critique a plan before implementation using gf-plan-reviewer.
  Default plan-critique path for this template. Enforces plan-quality hard gates,
  revise→re-review loop (max 2 passes), and no implement until approve/waiver.
  Use before coding, for plan critique, or /plan-review-loop.
  Optional /cold-review only if grok inspect lists it (external plugin).
disable-model-invocation: true
---

# Skill: Plan Review Loop

## Default path

**This skill is the default plan critique** for installed templates.

Optional: if `/cold-review` appears in `grok inspect` for this workspace (often an external Claude plugin), you may use it for adversarial review — still apply **hard gates** from `.grok/docs/plan-quality-standards.md` and the **same** loop policy (max **2** passes). Cold-review is **not** required and is **not** installed by `install_agentic_team.py`.

## Inputs

- Plan path: prefer `docs/plans/<name>.md`. If only session plan exists, copy session `plan.md` to `docs/plans/` first (after Plan Mode allows non-plan writes, or after exiting plan mode).
- Max review passes: **2** (hard cap).
- Standards: `.grok/docs/plan-quality-standards.md`

## Hard gates (reject Approve if any fail)

1. Goal + measurable acceptance criteria  
2. Non-goals  
3. Risk / blast radius  
4. Ordered implementation steps with **verification per step**  
5. Testing strategy (unit + edge/negative + coverage expectation or NO COVERAGE TOOL + waiver path)  
6. Failure modes  
7. Observable verification (reject “works correctly” / “should work”)  
8. UI/UX design when the plan touches UI — state inventory, design reference, a11y, falsifiable design criteria per `.grok/docs/ui-design-standards.md` (N/A counts as pass when no UI)  

## Loop (mandatory)

```
pass = 1
while pass <= 2:
  1. Read plan + plan-quality-standards.md
  2. Prepend full .grok/personas/instructions/gf-plan-reviewer.md to child prompt
  3. Spawn from Lead only:
       - subagent_type: general-purpose + capability_mode: read-only
         OR subagent_type: explore | plan
       - description: [gf-plan-reviewer] plan review pass N  (UI label only)
       - Prompt = persona + plan path + standards path + Review Report schema
         + “Do not edit product code.”
  4. Write report → docs/plans/<name>.review.md  (pass 2 → .review-2.md)
  5. If Overall == Approve: break (exit ready-for-user-approve)
  6. If pass == 2:
       escalate — max reviews used; optional plan edits may continue outside this loop
       break
  7. Else (pass 1 and Request Changes | Major Concerns):
       - Lead/author applies Required Changes to the plan (material edits required)
       - Do not re-run review on an unchanged plan
       - pass += 1
if still not Approve:
  do not implement unless user accepts residual hard-gate failures
  with durable waiver under docs/waivers/
  (prefer Overall: Major Concerns for unsafe/unbounded plans; Request Changes residual
   hard-gate gaps after pass 2 also require waiver — any Overall other than Approve)
```

## Steps (detail)

1. Confirm plan path under `docs/plans/`.  
2. Run loop above (max 2 passes).  
3. Present final Review Report + revised plan to user.  
4. **Do not implement** until user approves **or** durable waiver covers residual hard-gate failures.  
5. Record residual risks / waivers paths in the handoff to implement.

## Exit criteria

| Outcome | Condition |
|---------|-----------|
| **Ready to implement** | Overall Approve (pass 1 or 2) **and** user approval |
| **Blocked** | Hard gates still failing after pass 2; no implement |
| **Waived residual** | User accepts residual hard-gate failures **and** durable `docs/waivers/<name>.md` exists |

Max **2** review passes; between pass 1 and pass 2 the plan **must** change. After pass 2 failure, escalate (no automatic third review). No silent Approve of weak plans.
