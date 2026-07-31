---
id: changelog
label: Changelog / Release notes
category: derived
audience: a user or integrator deciding whether this release affects them
answers: "What changed, and do I need to do anything?"
output: CHANGELOG.md
emit_at: implement-handoff
coverage_source: .grokbit/plans/{slug}/implement/handoff.md
ask_cap: 1
sections:
  - id: summary
    title: Summary
    derive_from: 01-intent.md#problem
  - id: added
    title: Added
    derive_from: implement/handoff.md#completed
  - id: changed
    title: Changed
    derive_from: test/results.md#regression
  - id: removed
    title: Removed
    derive_from: plan.md#disposition-summary
  - id: breaking
    title: Breaking changes
    derive_from: test/results.md#regression
    ask: "Anything here that will break an existing caller?"
    required: true
  - id: action
    title: Action required
    derive_from:
      - test/release-readiness.md#caveats
      - test/release-readiness.md#environment-parity
verify: [links_follow, citations_valid]
---

Write from the reader's side of the boundary. "Refactored the token service" is a commit message; "password reset links now expire after one hour instead of twenty-four" is a changelog entry. If a change is invisible to the reader, it does not belong here.

The `INTENDED` rows in `test/results.md#regression` are your Changed section, already classified and already citing the design line that authorised each one. The `REPLACE` rows in the disposition summary are your Removed section.

Breaking changes and required actions go at the top regardless of section order. A reader who misses a required migration because it was in the ninth section will not blame themselves.

Emit at implement handoff. Written three weeks later this becomes archaeology — a model reading commit messages and guessing at user impact.

`CHANGELOG.md` is a living document across releases: emitting this type means **prepending** the new dated section above whatever is already there, never regenerating or overwriting the file — see `references/registry.md` § Living documents.

Pull env-var additions from `release-readiness.md#environment-parity` into Action required. A new required variable is a breaking change for anyone deploying, even though nothing in the code broke.
