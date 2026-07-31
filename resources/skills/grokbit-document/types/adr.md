---
id: adr
label: Architecture Decision Record
category: derived
audience: an engineer months from now deciding whether to revisit this choice
answers: "Why is it built this way, and what else was considered?"
output: docs/adr/{nnnn}-{slug}.md
emit_at: plan-approval
coverage_source: .grokbit/plans/{slug}/03-design.md
ask_cap: 2
sections:
  - id: status
    title: Status
    derive_from: plan.md#approval
  - id: context
    title: Context
    derive_from: 01-intent.md#problem
    required: true
  - id: constraints
    title: Constraints
    derive_from: 01-intent.md#constraints
  - id: options
    title: Options considered
    derive_from: 03-design.md#options-considered
    required: true
  - id: decision
    title: Decision
    derive_from: 03-design.md#decision
    required: true
  - id: supersession
    title: What this replaces
    derive_from: 03-design.md#disposition-of-superseded-code
  - id: consequences
    title: Consequences
    derive_from: 04-review.md
    ask: "What gets harder or more constrained because of this choice?"
verify: [links_follow, citations_valid]
---

This type is close to a pure rendering job. `03-design.md` already contains options, trade-offs, the decision, and what the rejected options were better at — which is the entire substance of an ADR.

**Rejected options are the value.** An ADR recording only the decision is a note; one recording what else was considered and why it lost is a document that answers the question people actually arrive with, which is "did they think about X?"

Emit at plan approval, while the reasoning is fresh. An ADR reconstructed later from commit history is a guess about motives written by something that was not present for the decision.

Pull consequences from `04-review.md` where possible. Reviewer findings the architect rebutted rather than fixed are consequences by definition — the plan accepted a cost, and the log recorded it.

Never rewrite an ADR after the fact. Supersede it with a new one and link back. The value of the series is that it shows how thinking changed, and editing history destroys exactly that.
