---
name: code-review-rubric
description: The standard this repo reviews code against, in strict priority order — correctness, security, design and maintainability, tests, then style. Apply it whenever reviewing or self-reviewing a change, judging a diff, or deciding whether code is ready to merge. This is a background standard.
user-invocable: false
---

# Code review rubric

Review in this priority order. A clean style never compensates for a correctness or
security defect. For each issue, state **severity** (Critical / Major / Minor / Nit),
the precise `path:line`, *why it matters*, and a concrete fix.

## 1. Correctness (highest priority)
- Does it actually do what it's supposed to, including the edge cases?
- Boundary conditions: empty, null/undefined, zero, negative, max, unicode, very large.
- Error and failure paths: are errors handled, surfaced, and not silently swallowed?
- Concurrency/ordering hazards: races, shared mutable state, await/async correctness.
- Resource handling: are files, connections, locks, and listeners released?
- Off-by-one, inverted conditions, wrong operator, copy-paste mistakes.

## 2. Security
- Untrusted input reaching a sink: injection (SQL/command/template), traversal, SSRF.
- Authn/authz: is every privileged action access-checked? Any IDOR?
- Secrets: none hardcoded, none logged. Crypto/randomness appropriate for the use.
- Unsafe deserialization, unsanitized output (XSS), permissive config/CORS.
- (Escalate security-sensitive diffs to the `security-auditor`.)

## 3. Design & maintainability
- Is this the simplest design that works? Any unneeded abstraction or premature
  generalization?
- Does it fit existing patterns and boundaries, or introduce an unjustified new one?
- Naming: do names say what things are/do? Is intent clear without a comment crutch?
- Coupling/cohesion: change isolated where it belongs? No leaking of internals?
- Duplication that should be unified (and the inverse: wrong abstraction forcing a fit).

## 4. Tests
- Do new behaviors have tests? Does a bug fix have a regression test?
- Do tests assert behavior (survive refactors) rather than implementation details?
- Are the meaningful cases covered — happy path, boundaries, error paths?
- Are tests deterministic, isolated, and fast?

## 5. Style & consistency (lowest priority — label as Nit)
- Matches the project's formatting/lint rules and idioms (formatter should own this).
- Comments explain *why*, not *what*; no stale or commented-out code.
- Public surfaces documented where non-obvious.

## Reviewer conduct
- Verify each claim against the code; never invent issues to look thorough.
- Separate blocking issues from preferences; mark nits as nits.
- If it's genuinely good, say so. End with a verdict: **Approve** /
  **Approve with nits** / **Request changes**, and the single top priority.
