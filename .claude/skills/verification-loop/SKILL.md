---
name: verification-loop
description: The core workflow for any non-trivial coding task in this repo — explore, plan, implement, verify, review, commit. Invoke it (or let it auto-load) whenever you're starting a feature, a fix, or a change that spans more than a trivial edit, to keep work disciplined and provably correct. Accepts an optional task description.
argument-hint: "[optional: the task to run through the loop]"
---

# The verification loop

The single workflow that keeps changes correct. Don't jump straight to editing —
move through the phases, and don't advance until the current phase's exit
criterion is met. Task (if given): **$ARGUMENTS**

## 1. Explore — understand before you touch anything
- Find and read the code, contracts, and tests the task actually involves.
- Read pointed scope directly; dispatch the `explorer` subagent only when the
  territory is wide *and* unfamiliar. If the planner is about to investigate the
  same scope anyway, skip this dispatch — the planner reads for itself.
- Never assume an API or a type — open it and confirm.
- **Exit when:** you can describe what exists today and where the change must go.

## 2. Plan — decide before you build
- State the goal, what's explicitly out of scope, the approach (and why over the
  alternative), the change surface, and the test strategy.
- For anything spanning >2 files, a new pattern, or a public-contract change, use
  the `planner` subagent / `/plan` and get the plan confirmed. The planner writes
  the plan to `docs/plans/<task>.md` with the implementation grouped into **work
  packages** — 1 for most tasks, 2–3 only when the work genuinely spans independent
  areas. Each package is the unit of delegation: one implementer dispatch per
  package, with that package's tests and doc updates inside it.
- **Exit when:** there's a plan document with grouped work packages you'd be
  comfortable handing to someone else.

## 3. Implement — the smallest correct diff
- Delegate one **whole work package** per `implementer` dispatch — never one agent
  per step or per file. The implementer builds the package end-to-end, including
  its tests (bring in `test-engineer` only when testing itself is the deliverable).
- Match existing conventions exactly. Touch only what the task needs; no drive-by
  refactors.
- If reality contradicts the plan, stop and surface it rather than improvising.
- **Exit when:** the package is implemented, its steps are ticked off in the plan
  document, and the diff is locally consistent.

## 4. Verify — prove it, don't assert it
- Run the real checks: typecheck, lint, and the relevant tests. Read failures and
  fix the *root cause*. Never weaken or skip a check to force green.
- Exercise the actual behavior (run it, hit the endpoint, reproduce the old bug and
  watch it not happen).
- New behavior ships with tests; a fix ships with a regression test that failed
  before and passes after.
- **Exit when:** everything is green for the right reasons. (The Stop hook enforces
  this independently — if it blocks you, the build is genuinely red.)

## 5. Review — a second pair of eyes
- Run the `code-reviewer` subagent **once, over the entire task's diff** — not per
  package, not per file. Add `security-auditor` only if the change touches
  anything security-sensitive.
- They review in fresh context and catch what your context can't. Address blocking
  findings; consciously accept or defer nits.
- **Exit when:** review is Approve / Approve-with-nits and blockers are resolved.

## 6. Commit — capture the logical change
- One logical change per commit, Conventional Commits format (see the
  `commit-conventions` skill). Don't bundle unrelated changes.
- **Exit when:** the work is committed with a message that explains the *why*.

## Looping and scaling
- Phases iterate: a verify failure sends you back to implement; a review finding may
  send you back to plan. That's the loop working, not a setback.
- **Small task?** Compress phases 1–2, but never skip phase 4.
- **Large task?** Decompose into work packages inside ONE plan document, dispatch
  one implementer per package (committing each green package), then verify and
  review the whole diff **once** at the end. Do not rerun explore/plan/review per
  package — that multiplies agents without adding safety.

## Agent economy
Every subagent is a fresh context that re-reads the codebase from zero — agents are
the most expensive resource in this loop. Budget them:
- A typical task through the full loop uses **at most ~5 agents**: planner, one
  implementer per work package (usually 1–3), and one reviewer. Explorer,
  test-engineer, security-auditor, and docs-writer are exceptions with specific
  triggers, not defaults.
- **Do it inline when you can.** A pointed read, a small well-understood edit, or a
  quick check belongs in the main thread, not in a dispatch.
- **Continue, don't respawn.** To follow up with an agent you already dispatched
  (a fix to its own diff, a clarification), message the existing agent rather than
  spawning a new one that starts from zero.
- **Fold work into packages.** Tests and doc updates ship inside the implementer's
  package. Separate `test-engineer` or `docs-writer` dispatches are only for tasks
  where tests or docs ARE the deliverable.
