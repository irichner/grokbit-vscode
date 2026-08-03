# Assumptions — Whole-product code review

## From intake

- Whole **product** scope is authoritative (user rejected WIP-only).
- `UNVERIFIED` Deliverable is still **findings + product verdict + Critical/Major backlog**, not automatic code fixes.
- Current tree = HEAD + working tree, reviewed as one system.

## From grounding (Loop 2)

- `UNRESOLVED — Loop 2` Full line counts / exhaustive annotation of `sidebar.ts`, `acp.ts`, `chat.js` deferred to implement layers with **DC9 sampling disclosure** — Survey listed modules and danger zones, did not claim line-complete reads.
- Coverage % cannot be measured (no coverage tool) — test mapping is presence/absence of named suites, not %.

## From adversarial review (Loop 3)

None surviving after force-checklist + compile script fixes.

## From verifiability (Loop 4)

- Layer tasks may write `findings-L1.md` … `findings-L7.md` intermediates; T8 merges to `findings.md`. Verify patterns accept either until merge completes.

## Resolution

- Human may require `npm run test:live` at the gate — if so, add verify step to T8 before implement starts.
- Human may require fixes immediately after findings — that is a **new implement plan**, not silent expansion of this one.
