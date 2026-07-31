---
id: contributing
label: Contributing guide
category: hybrid
audience: a new contributor about to open their first pull request
answers: "How do I work in this repo without breaking its conventions?"
output: CONTRIBUTING.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/02-survey.md
ask_cap: 3
sections:
  - id: setup
    title: Local setup
    derive_from: implement/preflight.md
    required: true
  - id: conventions
    title: Conventions
    derive_from: 02-survey.md#conventions
    required: true
  - id: tests
    title: Running tests
    derive_from: implement/preflight.md
  - id: structure
    title: Where things live
    derive_from: 02-survey.md#entity-resolution
  - id: danger
    title: Handle with care
    derive_from: 02-survey.md#danger-zones
  - id: process
    title: Pull request process
    ask: "Who reviews, what has to pass, and how do changes get released?"
verify: [commands_run, paths_resolve]
---

`02-survey.md#conventions` is this document's spine. The survey recorded how errors are *actually* handled, how tests are *actually* written, and how things are *actually* named, each with a cited example — which is more accurate than what anyone would write from memory. Repos habitually document the convention they intended rather than the one they follow.

The danger-zones section is unusually valuable and almost never present in real contributing guides. "This file is imported by eleven modules and has no test coverage" is exactly what a new contributor needs before their first change, and exactly what nobody thinks to write down.

Cite a real example for each convention. "We use Result types for errors, see `src/lib/http.ts:34`" beats a paragraph explaining the philosophy, because the reader is going to copy the nearest example regardless.

Keep the process section short and true. An aspirational six-stage review process that nobody follows teaches new contributors that the document is fiction, and they will then ignore the accurate parts too.
