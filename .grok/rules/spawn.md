# Spawn checklist (auto-loaded)

Lead-only `spawn_subagent` (depth 1). Children cannot spawn.

## Every spawn

1. **Prepend** full persona instruction file text when using a `gf-*` specialist  
   (e.g. `.grok/personas/instructions/gf-qa.md`). Tags like `[gf-qa]` are **UI labels only**.  
2. **Set `capability_mode` explicitly** on the tool call — do not rely on persona/role TOML defaults.  
   - QA / test runners: `execute` or `all`  
   - Plan reviewers: `read-only` (or `explore` / `plan` agent type)  
   - Implementers: `all` (or `read-write` if no shell needed)  
3. **Description** starts with a bracketed tag for the pager label: `[gf-qa] …`, `[gf-backend] …`.  
4. Prefer `isolation: worktree` only when git exists and edits must not collide; integrate before claiming done.

## Roles / personas

`.grok/roles/*.toml` and persona `default_capability_mode` are **catalog metadata only** — not spawn binding. Skills and this checklist still require explicit `capability_mode` + instruction prepend.

## Do not

- Nest orchestration skills under a child.  
- Assume a persona name is applied without prepending its instruction file.  
- Claim Ready:yes for implementers without green targeted tests when shell was available.
