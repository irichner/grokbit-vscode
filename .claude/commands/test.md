---
description: Run the test suite (optionally filtered) and triage any failures down to root cause.
argument-hint: [optional test name or path filter]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Task
---

Run the project's tests and report the result. Optional filter: **$ARGUMENTS**

1. Run the appropriate test command for this stack (use the one from `CLAUDE.md` →
   Project Facts; apply the filter "$ARGUMENTS" if given, otherwise run the full
   relevant suite).
2. If everything passes, report a concise summary (counts, time) and stop.
3. If anything fails, **do not patch blindly.** Read the failure output, then engage
   the `debugger` subagent (which follows the `debug-protocol` skill) to find the
   true root cause of each distinct failure before proposing any fix.
4. Distinguish a real product/code bug from a broken or flaky test, and say which it
   is. Propose the minimal correct fix; don't change a test to mask a real defect.

Report: what ran, what failed, the root cause of each failure, and the recommended
fix — implementing it only if I ask, or via `/ship` for anything non-trivial.
