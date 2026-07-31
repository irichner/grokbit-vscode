---
id: test-plan
label: Test plan & coverage report
category: derived
audience: a reviewer or QA lead deciding whether this is adequately verified
answers: "What is proven, what is not, and where are the gaps?"
output: docs/testing/{slug}-test-plan.md
emit_at: test-verdict
coverage_source: .grokbit/plans/{slug}/test/results.md
ask_cap: 1
sections:
  - id: scope
    title: Scope
    derive_from: 01-intent.md#done-criteria
    required: true
  - id: out-of-scope
    title: Out of scope
    derive_from: 01-intent.md#non-goals
  - id: approach
    title: Approach
    derive_from: test/baseline.md
  - id: coverage
    title: Criteria coverage
    derive_from: test/results.md#done-criteria-coverage
    required: true
  - id: regression
    title: Regression results
    derive_from: test/results.md#regression
  - id: gaps
    title: Known gaps
    derive_from: test/baseline.md
    required: true
  - id: pre-existing
    title: Pre-existing failures
    derive_from: implement/preflight.md#pre-existing-test-failures
verify: [commands_run, citations_valid]
---

Near-total derivation. `test/results.md` already carries the coverage matrix, regression classifications, and evidence — this type mostly reformats it for someone who was not in the session.

**Lead with the gaps.** The `UNVERIFIED` criteria and the `NOT CAPTURED` baseline entries are the highest-value content in the document, and the easiest to bury. A reader who takes away "everything passed" from a run that could not check three criteria has been actively misled, which is worse than not having the report.

Separate pre-existing failures from new ones explicitly. Preflight recorded which tests were already red, and conflating the two either inflates the apparent damage or hides real regressions inside expected noise.

Every `INTENDED` regression classification cites a design line. Carry those citations through — they are what lets a reviewer check the judgment rather than accept it.

Written honestly, this is the document that most changes what a reviewer does next, because it tells them where to spend their attention.
