---
description: Review the current working changes for correctness, security, and maintainability, ranked by severity.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git status:*), Task
model: opus
---

## Changes under review

- Status:
!`git status --short`

- Unstaged diff:
!`git diff`

- Staged diff:
!`git diff --staged`

## Task

Review the changes shown above against the `code-review-rubric` skill, in priority
order (correctness → security → design → tests → style).

1. Run the `code-reviewer` subagent on this diff for the full review.
2. If the diff touches anything security-sensitive (auth, input handling, queries,
   file/path ops, crypto, secrets, networking, dependencies), also run the
   `security-auditor` subagent and fold in its findings.
3. Present findings grouped by **severity** (Critical / Major / Minor / Nit), each
   with `path:line`, why it matters, and a concrete fix. Separate blocking issues
   from preferences.

End with a one-line verdict — **Approve** / **Approve with nits** / **Request
changes** — and the single most important thing to address. Do not edit code; this
is review only.
