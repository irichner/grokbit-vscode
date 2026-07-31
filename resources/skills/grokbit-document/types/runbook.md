---
id: runbook
label: Runbook
category: derived
audience: whoever is on call at 2am, under stress, who did not write this
answers: "It is broken. What do I do right now?"
output: docs/runbooks/{slug}.md
emit_at: test-verdict
coverage_source: .grokbit/plans/{slug}/test/release-readiness.md
ask_cap: 3
sections:
  - id: symptoms
    title: Symptoms
    derive_from: 03-design.md#unhappy-paths
    required: true
  - id: first-checks
    title: First checks
    derive_from: test/release-readiness.md#build
    required: true
  - id: env
    title: Required configuration
    derive_from: test/release-readiness.md#environment-parity
  - id: rollback
    title: Rollback
    derive_from: plan.md#tasks
    required: true
  - id: migrations
    title: Migrations
    derive_from: test/release-readiness.md#migrations
  - id: escalation
    title: Escalation
    ask: "Who gets called when the runbook does not resolve it?"
verify: [commands_run, paths_resolve]
---

Write for someone tired, stressed, and unfamiliar. That reader shapes every formatting decision: action first, explanation second or omitted, no prose the reader must parse before acting.

Organise by symptom, not by component. The reader knows what they are seeing — a 500, a stuck queue, a failed deploy. They do not know which component owns it, and asking them to work that out first is the failure of most runbooks.

Every rollback command comes from a plan task's `rollback` field, where it was written by something that knew what the task changed. Those are more trustworthy than a rollback improvised under pressure.

Environment parity from `release-readiness.md` is the highest-yield section. A missing env var is among the most common production failures and among the fastest to fix once identified — the runbook's job is to make that identification take thirty seconds.

Every command must be copy-pasteable with no prior shell state. At 2am nobody is going to work out which directory you assumed.

Keep it short. A runbook long enough to need scrolling is a runbook nobody finishes.
