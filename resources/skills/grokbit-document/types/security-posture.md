---
id: security-posture
label: Security posture
category: derived
audience: a security reviewer, or a customer's questionnaire
answers: "What are the risks here, and what is being done about them?"
output: docs/security/{slug}-posture.md
emit_at: test-verdict
coverage_source: .grokbit/plans/{slug}/test/security.md
ask_cap: 2
sections:
  - id: scope
    title: Scope of this assessment
    derive_from: implement/handoff.md#surface-changed
    required: true
  - id: authn
    title: Authentication and authorization
    derive_from: 03-design.md#shape-of-the-change
  - id: data
    title: Data handling
    derive_from: 03-design.md#migration
  - id: findings
    title: Findings
    derive_from: test/security.md
    required: true
  - id: accepted
    title: Accepted risks
    derive_from: test/security.md
    ask: "Who accepted each open finding, and on what date?"
  - id: dependencies
    title: Dependency posture
    derive_from: implement/progress.md
verify: [citations_valid, links_follow]
---

Be precise about scope. This assesses the change, not the whole system, and a document that implies otherwise is dangerous in a way that a merely incomplete one is not — someone will cite it as evidence the system was reviewed.

Never soften a finding's severity for presentation. `test/security.md` classifications are the record; carry them across unchanged, including the ones still open.

Accepted risks need a named person and a date. An accepted risk with no name is an ignored risk with better formatting, and the distinction matters entirely at audit time.

**Never restate a secret, key, or token, even redacted, even one already rotated.** Where a credential exposure occurred, record that it happened, that rotation was required, and when it completed.

If any `CRITICAL` finding is open, that fact belongs in the first paragraph. This is the one document type where burying the lede has a plausible path to real harm.
