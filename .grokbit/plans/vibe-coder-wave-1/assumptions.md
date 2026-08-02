# Assumptions — Vibe-coder Wave 1

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` — Mid-turn steer via cancel-then-send is acceptable product behavior for vibe users; default remains additive queue.
- `UNVERIFIED` — Hashing `rawInput.content` when present is sufficient for highest-risk Write bait-and-switch; Edit-only stays path-bound.
- `UNVERIFIED` — Node `crypto.createHash("sha256")` is fine inside `permission-bind` for host + vitest.
- Decided — Wave scope is trust content-bind + mid-turn steer/queue UX only (not full research roadmap).

## From grounding (Loop 2)

- None unresolved. Survey shortcuts noted (autoApprove grant path confirmed in review).

## From adversarial review (Loop 3)

- None outstanding. R1 BLOCKER (durable+digest) closed by design: digest only on non-durable grants.
- Residual product honesty: Auto-accept (`allow_always`) remains path-scoped for content — intentional, not a failed loop item.

## From verifiability (Loop 4)

- None. All tasks have runnable `npm test -- …` verifies on Windows-friendly syntax.

## Resolution

- Human at gate should confirm: (1) content bind only on Allow once + Write content is enough for this wave; (2) steer shortcuts table is acceptable; (3) full research backlog items (subagents, vision, Actions watcher) stay out of scope.
