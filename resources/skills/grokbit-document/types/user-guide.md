---
id: user-guide
label: User guide
category: authored
audience: someone trying to accomplish a task, who does not care how it is built
answers: "How do I do the thing I came here to do?"
output: docs/guides/{slug}.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/01-intent.md
ask_cap: 5
sections:
  - id: goal
    title: What you will accomplish
    ask: "What is the user trying to get done, in their words? Not the feature name."
    required: true
  - id: before
    title: Before you start
    derive_from: implement/preflight.md
  - id: steps
    title: Steps
    derive_from: 01-intent.md#done-criteria
    ask: "Walk through the flow as a user experiences it, screen by screen."
    required: true
  - id: verify
    title: How to tell it worked
    derive_from: 01-intent.md#done-criteria
  - id: problems
    title: If something goes wrong
    derive_from: 03-design.md#unhappy-paths
verify: [commands_run, paths_resolve, links_follow]
---

The most authored type in the registry, and the reason is worth stating plainly: **your code says what the software does, and nothing in the repo says why anyone opened it.** Task intent is the one thing derivation genuinely cannot reach, which is why the gap questions here are about goals rather than features.

Organise by user goal, never by feature. "Reset a forgotten password" is a guide; "Password reset module" is a reference section with a guide's name on it.

Write in second person, present tense, one action per step. Every step should be something the reader does, not something the system does — system behavior belongs in the result, not the instruction.

Done-criteria from `01-intent.md` translate almost directly into the "how to tell it worked" section, since they were written as observable actions specifically so a human could check them.

The fresh-reader test matters more here than anywhere else in the registry. This is the type most likely to assume knowledge the author forgot they had, because the author built the thing and cannot un-know how it works.
