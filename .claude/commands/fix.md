---
description: Diagnose and fix a reported problem — reproduce it, find the root cause, fix the cause (not the symptom), and add a regression test.
argument-hint: [describe the bug / failure / unexpected behavior]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
---

A problem has been reported:

> **$ARGUMENTS**

Resist the urge to jump straight to a patch. Follow the `debug-protocol` skill and
work the problem in order.

1. **Reproduce.** Establish a reliable, minimal reproduction first. If you cannot
   reproduce it, say so and gather what you'd need rather than guessing.
2. **Diagnose.** If the reproduction makes the root cause obvious, state it with the
   evidence and move on. Otherwise dispatch the `debugger` subagent to find the
   *root cause* — the specific line or decision responsible — using observed
   evidence, not hunches. It diagnoses; it does not patch.
3. **Fix and prove it — one dispatch.** With the cause confirmed, use a single
   `implementer` dispatch to make the smallest correct change AND write the
   regression test that **fails before** the fix and **passes after** (per the
   `tdd` skill — write the failing test first). Don't paper over a symptom, don't
   smuggle in unrelated cleanup, and don't spawn a separate agent for the test.
4. **Verify.** Run the full relevant check suite — the fix is not done until
   everything is green for the right reasons.

Report the root cause in one or two sentences, the fix, and the test that now guards
it. If the investigation reveals the real bug is elsewhere or larger than reported,
stop and surface that before changing code.
