# The Verification Loop

This template is built around one idea: **code is not done when it's written — it's
done when it's verified.** Everything here (the subagents, the skills, the commands,
the hooks) exists to make that loop the path of least resistance.

```
   ┌──────────┐   ┌────────┐   ┌────────────┐
   │ EXPLORE  │ → │  PLAN  │ → │ (checkpoint)│
   └──────────┘   └────────┘   └──────┬─────┘
        ▲                              │
        │                              ▼
   ┌────┴─────┐   ┌──────────┐   ┌───────────┐
   │  COMMIT  │ ← │  REVIEW  │ ← │ IMPLEMENT  │
   └──────────┘   └──────────┘   │ + VERIFY   │
                                 └───────────┘
        (loop back any time reality contradicts the plan)
```

The loop is deliberately the same whether you drive it by hand or run `/ship`. The
phases scale down for small tasks — but the *order* doesn't change.

---

## The phases

### 1. Explore — understand before you touch
Map the relevant code, contracts, and conventions **before** proposing a change. The
`explorer` subagent does this read-only on a cheap model and returns a compact map:
what's relevant, where it lives (`path:line`), how it fits together, and what's still
unknown. Cost: low. Value: every later phase gets better.

**Exit criteria:** you can name the files you'll touch and the contracts you must not
break.

### 2. Plan — decide the approach on purpose
Turn understanding into a concrete, testable plan: scope, approach (and *why* this one
over the alternatives), the change surface, a test strategy, and the risks. The
`planner` subagent produces this without editing anything. Decisions worth remembering
become an ADR (the `adr` skill).

**Exit criteria:** a step-by-step plan a competent stranger could follow, with a clear
test strategy.

### 3. Checkpoint — cheap to change your mind here
The one human gate. `/ship` **pauses after planning, before code**, so you can correct
course while it's still just words. A trivial task can wave this through; anything with
real surface area should stop here. This is where steering is cheapest.

### 4. Implement — smallest correct diff
Build the plan one step at a time as the **smallest change that fully solves it** — no
opportunistic refactors, no speculative abstraction. The `implementer` subagent does
this and self-verifies as it goes. Tests come from the `test-engineer` (test-first
where it fits, via the `tdd` skill): test *behavior*, not implementation.

**Exit criteria:** the plan is built and the author believes it works — and can show
why.

### 5. Verify — prove it, don't assert it
Typecheck, lint, and the relevant tests pass **for the right reasons**. Fix root
causes; never weaken a check to make it green. This phase is not optional and not
manual — the **Stop hook enforces it** (see below).

**Exit criteria:** all checks green, no suppressed failures, no skipped tests papering
over a problem.

### 6. Review — a second, skeptical pass
The `code-reviewer` subagent reviews the diff against the `code-review-rubric`, in
priority order (correctness → security → design → tests → style), and reports findings
by severity with `path:line` and a concrete fix. Security-sensitive diffs also get the
`security-auditor`. Blocking issues get resolved; nits get consciously accepted or
deferred.

**Exit criteria:** no Critical/Major findings open; a clear Approve / Request-changes
verdict.

### 7. Commit — one logical change, explained
Commit per the `commit-conventions` skill: Conventional Commits, one logical change per
commit, a subject that says *what* and a body that says *why*. Pushing and PRs are
separate, deliberate steps (`/pr`).

---

## How the surfaces cooperate

The same loop is encoded redundantly across surfaces, so it holds whether you invoke it
explicitly or not:

| Surface | Role in the loop |
|---|---|
| **CLAUDE.md** | States the loop and the Definition of Done as standing policy. |
| **Subagents** | One specialist per phase, each with least-privilege tools and a fit-for-purpose model. |
| **Skills** | The reusable *method* for a phase (`verification-loop`, `tdd`, `debug-protocol`, `code-review-rubric`, `commit-conventions`). |
| **Commands** | Operator entry points that drive the loop (`/ship`, `/plan`, `/fix`, `/review`, `/test`, `/commit`, `/pr`, `/checkpoint`). |
| **Hooks** | The *enforcement*: protect secrets and the guardrails themselves, and **block "done" until verification passes**. |

The key insight: **policy alone is advisory; the Stop hook makes verification load-
bearing.** Even if a model forgets the rule, `verify-on-stop.sh` runs the checks and
refuses to let the turn end while they're red (up to a bounded number of retries, so a
genuinely stuck run can't burn tokens forever).

---

## Driving it by hand

You don't have to run `/ship`. The same loop, manually:

1. `/plan add rate limiting to the login endpoint` — explore + plan, no edits.
2. Read the plan, adjust, agree on the approach.
3. Implement (or let the `implementer` subagent take a step at a time).
4. `/test` — run and triage.
5. `/review` — skeptical pass on the diff.
6. `/commit` — Conventional Commit once green and reviewed.
7. `/pr` — when the branch is ready to share.

`/checkpoint` at any time tells you where you stand. `/fix` runs the debugging variant
of the loop when something's broken.

The loop is the product. The features are just how it's made unavoidable.
