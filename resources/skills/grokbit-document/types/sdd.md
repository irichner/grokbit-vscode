---
id: sdd
label: Solution Design Document
category: hybrid
audience: an implementation team, and the client who signs off on the design
answers: "How is the solution structured, component by component?"
output: docs/design/{slug}-sdd.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/03-design.md
ask_cap: 4
sections:
  - id: overview
    title: Solution overview
    derive_from: 01-intent.md#problem
    required: true
  - id: scope
    title: In scope / out of scope
    derive_from: 01-intent.md#non-goals
    required: true
  - id: architecture
    title: Architecture
    derive_from: 03-design.md#shape-of-the-change
    required: true
  - id: components
    title: Components
    derive_from: 02-survey.md#entity-resolution
  - id: data
    title: Data model and migration
    derive_from: 03-design.md#migration
  - id: integrations
    title: Integrations and dependencies
    derive_from: 03-design.md#new-dependencies
  - id: errors
    title: Error handling
    derive_from: 03-design.md#unhappy-paths
  - id: nfr
    title: Non-functional requirements
    derive_from: 01-intent.md#constraints
    ask: "Performance, availability, retention, or compliance targets?"
  - id: assumptions
    title: Assumptions and open items
    derive_from: assumptions.md
    required: true
verify: [citations_valid, links_follow]
---

A client-facing sibling to the ADR: same underlying design, structured for sign-off rather than for a future engineer.

Scope boundaries carry contractual weight here. `01-intent.md#non-goals` was written to catch scope inflation during planning and does double duty as the exclusions section — it is more precise than exclusions written after the fact, because it was written before anyone had an incentive to be vague.

Carry `assumptions.md` through verbatim and prominently. An assumption that survives into a signed design document is a shared assumption; one quietly dropped becomes a dispute later.

Non-functional requirements rarely derive well. `01-intent.md#constraints` catches some, but targets for throughput, availability, and retention usually live in the client's head. Ask specifically rather than leaving a heading with nothing under it.

Where the design chose `COEXIST` for superseded code, say so explicitly. A client reading a design that silently leaves two implementations in place has not been told about the maintenance cost they are agreeing to.
