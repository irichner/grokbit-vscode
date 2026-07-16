# Test Accuracy Standards

**Mandatory read** for `gf-qa` and anyone judging GO/NO-GO on tests
(`read_file` this document before accuracy verdicts).

## Good

- Fails when the bug is reintroduced (regression-proof).
- Edge/negative cases for non-trivial branches (≥1 required).
- Contract checks at boundaries (API, CLI, events, serialization).
- Mock I/O boundaries, not SUT internals.
- Deterministic (seed time/network); assert public interface over private guts.
- Names and assertions describe the behavior under test.

## Blockers (NO-GO)

- Only mock call-order assertions on the SUT (circular / over-mocked).
- Meaningless snapshot updates without behavior intent.
- Happy-path-only for error/auth/data-loss code.
- Flaky time/network without control.
- Tests that cannot fail (tautologies, assert True, empty tests).
- “Coverage theater”: high line % with no assertion on the changed behavior.

High coverage with inaccurate tests is still failure.

## Edge / negative minimum

For each non-trivial behavior in the diff, require at least one of:

- Invalid input / rejected command  
- Empty / boundary collection  
- Unauthorized / forbidden path  
- Error or timeout path  
- Idempotency or double-submit where relevant  

Happy-path-only suites for non-trivial logic → **gap** (blocks GO).

## Relation to gates

- Accuracy failure = **gap** → blocks merge same as open review bug when mapped by AGENTS.md.  
- Prefer tests that would catch the seeded bug in Fixture B style scenarios.  
- Full policy cross-links: `.grok/rules/accuracy-coverage.md`, `.grok/docs/coverage-policy.md`.
