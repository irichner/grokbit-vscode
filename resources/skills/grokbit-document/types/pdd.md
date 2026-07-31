---
id: pdd
label: Process Design Document
category: hybrid
audience: the delivery team building the automation, and the process owner approving it
answers: "What is the process, step by step, including every exception?"
output: docs/process/{slug}-pdd.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/01-intent.md
ask_cap: 5
sections:
  - id: purpose
    title: Process purpose
    derive_from: 01-intent.md#problem
    required: true
  - id: owner
    title: Process owner and stakeholders
    ask: "Who owns this process, and who signs off on changes to it?"
    required: true
  - id: current
    title: Current (as-is) process
    derive_from: 02-survey.md#supersession
    ask: "Walk through how this is done today, step by step."
    required: true
  - id: target
    title: Target (to-be) process
    derive_from: 03-design.md#shape-of-the-change
    required: true
  - id: inputs
    title: Inputs and systems
    derive_from: 02-survey.md#entity-resolution
  - id: rules
    title: Business rules
    derive_from: 01-intent.md#done-criteria
  - id: exceptions
    title: Exception handling
    derive_from: 03-design.md#unhappy-paths
    ask: "What happens when each step fails? Who handles it manually?"
    required: true
  - id: volumes
    title: Volumes and timing
    ask: "How many transactions, how often, and within what window?"
  - id: kpis
    title: Success measures
    derive_from: 01-intent.md#done-criteria
verify: [citations_valid, links_follow]
---

Exception handling is the section that determines whether the automation survives contact with production, and it is the section most often written as a placeholder. Every step needs a stated failure behavior and a named human fallback. `03-design.md#unhappy-paths` covers the technical failures; the business exceptions — the record that does not match, the approval that never arrives — usually have to be asked for.

As-is and to-be must both be present and must differ visibly. A PDD whose current-state section is a lightly reworded target state has not captured a process; it has captured a wish.

Volumes and timing rarely exist anywhere in a repo. Ask, and record the answer as stated including its uncertainty — "roughly 400/day, spikes at month end" is more useful than a confident number nobody can source.

Business rules should be enumerated and individually checkable, in the same spirit as done-criteria. A rule stated as a paragraph will be implemented three different ways.

Name the process owner. An automation with no owner has nobody to escalate to when it breaks, and it will break.
