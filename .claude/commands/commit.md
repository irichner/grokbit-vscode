---
description: Create a clean Conventional Commit from the currently staged changes.
argument-hint: [optional intent or scope hint]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
---

## Working tree

- Status:
!`git status --short`

- Staged diff:
!`git diff --staged`

## Task

Create one well-formed commit for the **staged** changes above, following the
`commit-conventions` skill (Conventional Commits).

- Extra intent from the operator (may be empty): **$ARGUMENTS**
- If **nothing is staged**, stop and say so. Show what's modified and ask what to
  stage rather than committing everything blindly.
- If the staged diff actually contains **more than one logical change**, point that
  out and recommend splitting it — propose how to split rather than burying unrelated
  work in a single commit.
- Choose the right `type` and an optional `scope` from the files touched. Write a
  concise, imperative subject (≤ ~72 chars) that completes "this commit will…", and a
  body that explains the **why** when it isn't obvious. Add a `BREAKING CHANGE:`
  footer if the public contract changed.

Show the exact message you intend to use, then create the commit. Do not stage new
files or amend prior commits unless explicitly asked. Pushing is out of scope here.
