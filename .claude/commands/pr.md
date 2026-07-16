---
description: Prepare a pull request for the current branch — summarize the changes and draft a reviewer-ready title and description.
argument-hint: [optional context or target branch]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Task
---

## Branch state

- Current branch & status:
!`git status --short --branch`

- Commits on this branch:
!`git log --oneline -20`

- Full diff vs. the base branch (tries origin/HEAD, then main, then master):
!`git diff origin/HEAD...HEAD 2>/dev/null || git diff main...HEAD 2>/dev/null || git diff master...HEAD 2>/dev/null || echo "(no base branch found — describe the work from the commit list above)"`

- Uncommitted changes (should be empty for a clean PR):
!`git diff HEAD`

## Task

Prepare a pull request for the work shown above. Extra context (may be empty):
**$ARGUMENTS**

1. **Sanity-check first.** If the working tree is dirty, or the branch looks like it
   contains unrelated commits, surface that before drafting — a clean, focused PR is
   the goal.
2. **(Optional) Final review.** If the change is non-trivial or sensitive, run the
   `code-reviewer` subagent on the diff and resolve blocking findings before opening
   the PR.
3. **Draft the PR.** Produce:
   - A **title** in Conventional Commit style — a clear, specific summary.
   - A **description** with: *Summary* (what & why, a few sentences), *Changes* (the
     notable edits as a short list), *Testing* (how it was verified), and *Notes /
     risks* (migrations, follow-ups, anything a reviewer must know). Keep it grounded
     in the actual diff — don't invent testing that wasn't done.

Output the title and description as ready-to-paste Markdown. Don't push or open the PR
unless asked and the relevant `gh`/remote tooling is permitted.
