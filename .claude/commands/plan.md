---
description: Explore the relevant code and produce a concrete, reviewable implementation plan. Makes no edits.
argument-hint: [what you want to plan]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch, Task
---

Produce an implementation plan for:

> **$ARGUMENTS**

Do **not** write or edit any code — this is planning only (the plan document under
`docs/plans/` is the one artifact produced).

1. Hand off to the `planner` subagent. It investigates the relevant code, contracts,
   and tests itself — do not pre-dispatch the `explorer` unless the territory is so
   wide and unfamiliar that the planner needs a map just to start.
2. The planner writes the plan to `docs/plans/<task>.md`: goal & explicit non-goals,
   the chosen approach and why over the main alternative, the change surface, the
   test strategy with the specific cases that matter, risks/open questions, and the
   implementation grouped into **work packages** — each package a batch that one
   implementer dispatch completes end-to-end, tests included. Fewer, larger packages
   beat many small ones: the package count is the implementation agent count.
3. Surface any genuine design fork as an open question for me to decide rather than
   silently choosing. If the decision has long-lived consequences, suggest recording
   it via the `adr` skill.

End by asking whether to proceed to implementation (e.g. via `/ship`).
