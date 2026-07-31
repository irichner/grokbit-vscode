---
id: brd
label: Business Requirements Document
category: authored
audience: business stakeholders approving scope, and the team estimating against it
answers: "What does the business need, and how will we know it worked?"
output: docs/requirements/{slug}-brd.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/01-intent.md
ask_cap: 5
sections:
  - id: background
    title: Background
    ask: "What business situation prompted this? What happens if nothing changes?"
    required: true
  - id: objectives
    title: Business objectives
    derive_from: 01-intent.md#problem
    required: true
  - id: scope
    title: Scope
    derive_from: 01-intent.md#non-goals
    required: true
  - id: requirements
    title: Requirements
    derive_from: 01-intent.md#done-criteria
    required: true
  - id: constraints
    title: Constraints
    derive_from: 01-intent.md#constraints
  - id: success
    title: Success measures
    ask: "What metric moves, by how much, by when?"
    required: true
  - id: assumptions
    title: Assumptions and dependencies
    derive_from: assumptions.md
  - id: risks
    title: Risks
    derive_from: 04-review.md
---

The most authored type here, because the repo contains the solution and not the business case. `01-intent.md` gets you objectives and requirements; background, success measures, and stakeholder context have to come from a person.

Requirements must be individually numbered and individually testable. `01-intent.md#done-criteria` were written as observable actions precisely so a human could check them, which makes them unusually good requirements — carry that property through rather than rewriting them into prose.

Success measures need a number, a direction, and a date. "Improve the reset experience" is not a measure. "Reduce password-reset support tickets by 40% within one quarter" is one, and it is the sentence that determines whether anyone can tell later whether this was worth doing.

Separate business requirements from solution decisions. Anything describing *how* belongs in the SDD, and mixing them makes the BRD impossible to approve — a stakeholder cannot sign off on a need that has an implementation welded to it.

Carry `04-review.md` findings into risks. Reviewer findings the architect rebutted rather than resolved are accepted risks, already written down with evidence.
