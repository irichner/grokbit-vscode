---
id: api-reference
label: API reference
category: derived
audience: a developer integrating against this, with the docs open beside their editor
answers: "What can I call, with what arguments, and what comes back?"
output: docs/api/{slug}.md
emit_at: on-request
coverage_source: src
ask_cap: 2
sections:
  - id: endpoints
    title: Endpoints
    derive_from: src:signatures:**
    required: true
  - id: auth
    title: Authentication
    derive_from: 03-design.md#shape-of-the-change
  - id: errors
    title: Errors
    derive_from: 03-design.md#unhappy-paths
    required: true
  - id: examples
    title: Examples
    derive_from: test/baseline.md
verify: [samples_compile, commands_run, citations_valid]
---

Derive from source signatures and types, never from the design. The design describes intent; the code is what callers hit. Where they diverge, document the code and report the divergence — it usually means an undocumented decision was made during implementation.

Error responses matter as much as success responses and are omitted far more often. `03-design.md#unhappy-paths` already enumerates the failure cases the plan considered; document the actual shape each returns.

Examples should use real values. `test/baseline.md` holds actual captured request and response pairs from a working system — better than anything constructed, because they provably worked.

There is no automated check that a documented signature still matches the source across arbitrary target languages — `scripts/verify_doc.py` is stdlib-only and this repo could be in anything. The guarantee here is upstream instead: derive signatures from the actual source at generation time (`src:signatures:**`, resolved fresh, never copied from `03-design.md`), and rely on `check_drift.py` afterward to flag the moment that source moves. An API reference that drifts from the code is worse than none: it sends people confidently in the wrong direction, and they trust it precisely because it is specific — which is exactly why `derived_from` on this type is not optional.

If the surface is large, generate per-module rather than one file. Nobody reads a 3,000-line reference; they search it, and search works better with smaller scopes and real headings.
