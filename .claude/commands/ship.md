---
description: Run a task through the full verification loop — explore, plan, (checkpoint), implement, verify, review, commit — delegating each phase to the right specialist.
argument-hint: [task description]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
---

You are orchestrating the verification loop for this task:

> **$ARGUMENTS**

Follow the `verification-loop` skill. Drive it phase by phase and use the subagents
as the workers — keep your own context focused on coordination and decisions.

**Agent budget:** a normal run of this command uses at most ~5 subagents total —
the planner, one implementer per work package (usually 1–3), and one reviewer.
Every dispatch beyond that needs a specific trigger. Do quick reads and small
well-understood edits inline instead of dispatching for them.

1. **Plan.** Use the `planner` subagent (or plan directly if the task is small). It
   investigates the code itself and writes the plan to `docs/plans/<task>.md`, with
   the implementation grouped into **work packages** — each package a batch one
   implementer completes end-to-end, tests included. Only dispatch the `explorer`
   first if the territory is so wide and unfamiliar that even the planner needs a
   map to start.
2. **Checkpoint with the operator.** Present the plan — especially the package
   grouping — and **pause for confirmation before writing code.** If the task is
   genuinely trivial, say so and proceed — but when in doubt, stop and ask.
   Incorporate any feedback into the plan document.
3. **Implement.** Dispatch **one `implementer` per work package**, pointing it at
   the plan document and its package. The implementer builds the whole batch —
   code, tests, and doc updates — and ticks off its steps in the plan file. Do not
   split a package across agents, dispatch per step, or pull in `test-engineer`
   unless testing itself is the deliverable. For follow-up fixes to a package,
   message that same implementer rather than spawning a fresh one.
4. **Verify.** Ensure typecheck, lint, and the relevant tests pass for the right
   reasons. Fix root causes; never weaken a check. (The Stop gate will hold you to
   this anyway.)
5. **Review.** Run the `code-reviewer` subagent **once over the entire diff** —
   after all packages land, not per package. Add the `security-auditor` only if the
   change touches anything security-sensitive. Resolve blocking findings;
   consciously accept or defer nits.
6. **Commit.** Once green and reviewed, commit per the `commit-conventions` skill —
   one logical change per commit (a work package is usually one commit), a message
   that explains the why.

Report progress at each phase transition. If reality diverges from the plan at any
point, stop and surface it rather than improvising past it.
