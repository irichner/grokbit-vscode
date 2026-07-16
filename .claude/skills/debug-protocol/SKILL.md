---
name: debug-protocol
description: A systematic method for finding the root cause of a bug instead of guessing — reproduce, observe, hypothesize, isolate, confirm, fix. Use when a test is failing, an exception is thrown, output is wrong, or behavior is flaky, especially when the cause isn't immediately obvious. Pairs with the debugger subagent.
---

# Debugging protocol (root cause, not symptom)

Guessing-and-checking wastes time and leaves latent bugs. Work the evidence.

## 1. Reproduce
- Find the exact, minimal way to trigger the failure: inputs, state, environment,
  sequence. Make it repeatable on demand.
- Can't reproduce it? That's finding #1 — capture what's known, add logging/telemetry
  around the suspected area, and narrow conditions until it's deterministic. Don't
  "fix" what you can't trigger.

## 2. Observe
- Read the failing path, the full stack trace, and the actual values flowing through.
- Gather facts before theories: what *is* happening vs. what you *expected*. Add
  temporary instrumentation to see real state (and remove it later).

## 3. Hypothesize — one at a time
- Form a single, falsifiable hypothesis about the cause ("X is null because Y returns
  early when Z").
- Predict what you'd observe if it's true, then check. One variable at a time.

## 4. Isolate (bisect)
- Shrink the search space: comment out / bypass halves, bisect recent commits
  (`git bisect`), or test layers in isolation until the fault is localized to a
  specific line, value, or interaction.

## 5. Confirm the mechanism
- State precisely *why* it breaks — the exact cause, not just the location. You should
  be able to explain the full chain from trigger to failure.
- If you can't explain it, you haven't found it yet. Keep going.

## 6. Fix at the root + lock it in
- Fix the underlying cause, not the surface symptom. A patch that hides the symptom
  (swallowing the error, special-casing the one input) is a future bug.
- Add a regression test that fails on the old code and passes on the fix.
- Re-run the full relevant suite to confirm no collateral breakage.

## Anti-patterns to avoid
- Shotgun changes ("change five things, see if it helps").
- Blaming the framework/compiler before exhausting your own code.
- Declaring victory because the symptom disappeared without understanding why.
