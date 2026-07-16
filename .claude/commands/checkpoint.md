---
description: Take stock mid-task — summarize what's changed so far, what's verified, and what's left, with a quick read on the uncommitted diff.
argument-hint: [optional focus question]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

## Snapshot

- Working tree:
!`git status --short --branch`

- Unstaged diff:
!`git diff`

- Staged diff:
!`git diff --staged`

- Recent commits:
!`git log --oneline -10`

## Task

Give a concise checkpoint of where this work stands. Optional focus (may be empty):
**$ARGUMENTS**

Cover, briefly:
1. **Done so far** — what the uncommitted changes and recent commits actually
   accomplish (read the diff; describe reality, not intentions).
2. **Health** — anything that looks unfinished, risky, or off in the current diff:
   debug leftovers, `TODO`s, half-applied edits, things that probably won't pass the
   checks. Flag it; don't fix it here.
3. **Remaining** — the shortest sensible path to done from here, as a few concrete
   next steps.

This is a read-only status check — do not edit code, stage, or commit. Keep it tight
and scannable; the point is orientation, not a full review (use `/review` for that).
