---
name: tdd
description: Test-driven development workflow — write a failing test first, make it pass with the simplest code, then refactor. Use when building new behavior whose shape is testable, fixing a bug (write the failing regression test first), or whenever you want the test to drive the design. Accepts an optional description of the behavior to build.
argument-hint: "[optional: the behavior or bug to drive out test-first]"
---

# Test-driven development (red → green → refactor)

Let the test define "done" before you write the code. Target: **$ARGUMENTS**

## Red — write a failing test
1. Pick the next smallest slice of behavior. Express it as one concrete test with a
   clear name describing the expectation.
2. Use the project's existing test framework and conventions (read a neighbouring
   test first).
3. **Run it and watch it fail** — for the *right reason* (asserting the missing
   behavior, not a typo or import error). A test that passes immediately, or fails
   for the wrong reason, isn't a real red.

## Green — make it pass, simply
4. Write the least code that makes the test pass. Don't build for hypothetical future
   cases; resist gold-plating.
5. Run the test (and the surrounding suite) until green. Don't edit the test to fit
   the code unless the test was genuinely wrong.

## Refactor — clean up under green
6. With the test passing, improve names, remove duplication, and clarify structure.
   Re-run tests after each move; they're your safety net (see the `refactorer` agent
   for larger cleanups).
7. Keep behavior identical during refactor — green stays green.

## Repeat
8. Loop one slice at a time. Each cycle adds one honest test and the minimal code to
   satisfy it, leaving the suite green.

## When TDD fits (and when it doesn't)
- **Great fit:** pure logic, parsers, calculations, bug regressions, well-specified
  APIs, anything with clear inputs/outputs.
- **Awkward fit:** exploratory spikes, hard-to-isolate UI/IO glue, or when the design
  is still unknown — spike first to learn, then come back and pin behavior with tests
  before it's considered done.

## Bug-fix variant
For a reported bug: first write the test that reproduces it (it fails on current
code), *then* fix until it passes. That test is the permanent guard against
regression.
