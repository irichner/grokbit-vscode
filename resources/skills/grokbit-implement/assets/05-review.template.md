# Scope audit log — <slug>

Append-only, one section per task. Never overwrite a previous task's entry.

## T1 — <title>
Reviewed: `<commit or diff range>`

- `IN_SCOPE` `path:line` — serves the task's intent, lives in a declared file
- `OUT_OF_SCOPE` `path:line` — <what it actually does> — resolution: reverted | promoted to `T<new>` (promoted from T1)
- `INCIDENTAL` `path:line` — formatting/import-order only, no behavior change — kept

### Round 2 (only if round 1 left contested hunks)
- <...>

## Outcome — T1
Rounds used: N of 2
Unresolved at cap: <none | reverted automatically per Loop I3 cap behavior>

## T2 — <...>
Reviewed: `<...>`

- `IN_SCOPE` <...>

A clean audit is a legitimate outcome — record it as plainly as a finding:

## T3 — <title>
Reviewed: `<...>`

Clean. Every hunk is `IN_SCOPE` or `INCIDENTAL`; nothing to revert or promote.
