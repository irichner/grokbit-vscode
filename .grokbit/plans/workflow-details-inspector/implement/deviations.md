# Deviations — workflow-details-inspector

Where reality diverged from the plan. The Orchestrator counts every row with
`counts: yes`; **at three, stop and re-plan** (Loop I5).

Counting total so far: **0 of 3.**

| # | Task | What diverged | counts | Disposition |
|---|---|---|---|---|
| — | — | none yet | — | — |

## Non-counting notes

- **Commit-message quoting (T3, tooling only).** A PowerShell single-quoted
  here-string carrying a message with embedded double quotes terminated early,
  and git parsed the remainder as pathspecs — the commit simply did not happen,
  no code was touched. Switched to `git commit -F <file>` for the rest of the
  session. `counts: no` — an environment/shell failure, not the plan being
  wrong, and per Step 2 it consumes no retry attempt (T3's own verify had
  already passed).

- **Commit-policy conflict (resolved before T1, not a plan deviation).** This
  skill's hard rule 2 requires a commit per task; CLAUDE.md forbids agent commits
  outside the rebuild/release paths. Put to the user, who chose commit-per-task
  with no push. Recorded here because it changes the session's mechanics and a
  future reader will otherwise find 11 unexplained commits on `main`.
  `counts: no` — a governance decision, not the survey being wrong.
