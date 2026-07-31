---
id: readme
label: README
category: hybrid
audience: someone who just landed on the repo and has not decided whether to invest in it
answers: "What is this, and how do I get it running?"
output: README.md
emit_at: on-request
coverage_source: .grokbit/plans/{slug}/02-survey.md
ask_cap: 3
sections:
  - id: what
    title: What this is
    derive_from: 01-intent.md#problem
    ask: "In one sentence, what does this project do and who is it for?"
    required: true
  - id: quickstart
    title: Quickstart
    derive_from: implement/preflight.md
    required: true
  - id: configuration
    title: Configuration
    derive_from: src:env:**
  - id: usage
    title: Common tasks
    derive_from: 01-intent.md#done-criteria
  - id: layout
    title: Project layout
    derive_from: 02-survey.md#conventions
  - id: troubleshooting
    title: Troubleshooting
    derive_from: implement/preflight.md#pre-existing-test-failures
verify: [commands_run, paths_resolve, links_follow]
---

The quickstart is the whole document. Most readers never scroll past it, and the ones who do have already decided to stay.

Derive it from `implement/preflight.md` rather than from what you assume the setup is — preflight recorded the runtime version actually required, the env vars actually needed, and the services actually running. That file is a setup guide written by something that had to make the project work from cold.

Every command must run in a clean container with no prior state. This is the type where executable verification pays for itself repeatedly, because a broken first command is the single most common documentation defect and it costs a reader immediately.

Keep the top short. The reader's question is "is this what I need and can I run it", and every paragraph before the answer is a paragraph they read while deciding to leave.

Do not document aspirational features. A README listing three things that do not work yet costs more trust than the features would have earned.
