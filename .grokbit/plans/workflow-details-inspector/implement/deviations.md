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

- **PowerShell text substitution corrupted a file (T5, tooling only).** Used
  `Get-Content | … | Set-Content -Encoding utf8` to rename two test lookups; PS
  5.1 read the UTF-8 file as ANSI and re-encoded it, turning every em dash into
  mojibake. Caught by an explicit encoding check in the same verify run and
  fixed by rewriting the file through the editor. Standing rule for the rest of
  this session: never munge source text through PowerShell string pipelines.
  `counts: no` — tooling, not the plan.

- **Foreign files appeared in the working tree mid-T5 (not this session's).**
  `.grokbit/context/`, `.grokbit/docs-manifest.json`,
  `docs/Grokbit-Features-and-Use-Cases.docx`, `docs/features-and-use-cases.md`,
  `scripts/_finalize_features_doc.py`, `scripts/_gen_features_use_cases_docx.py`
  — timestamps 22:15–22:16, from something running outside this pipeline.
  Verified against `git log --name-only` that no commit of this session swept
  them in. Staging switched from `git add -A` to explicit paths for every
  remaining task. They are left untracked and untouched; the user should decide
  what they are. `counts: no` — not a divergence from the plan.

- **Commit-policy conflict (resolved before T1, not a plan deviation).** This
  skill's hard rule 2 requires a commit per task; CLAUDE.md forbids agent commits
  outside the rebuild/release paths. Put to the user, who chose commit-per-task
  with no push. Recorded here because it changes the session's mechanics and a
  future reader will otherwise find 11 unexplained commits on `main`.
  `counts: no` — a governance decision, not the survey being wrong.
