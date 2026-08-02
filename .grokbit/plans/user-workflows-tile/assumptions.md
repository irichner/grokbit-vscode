# Assumptions — User Workflows (Grok + Claude)

## From intake

- `UNVERIFIED` Grok seed: `/workflow <name> ` (trailing space).
- `UNVERIFIED` Claude seed: same form or bare `/<name> ` — lock in T1/T5 with evidence.
- `UNVERIFIED` Claude files primarily `.js` under project/user `.claude/workflows/`; `.ts` optional if CLI loads them.
- `UNVERIFIED` User-scope Claude dir is `~/.claude/workflows` (or under `CLAUDE_CONFIG_DIR` if set — implement should mirror how other Claude home paths resolve in this repo, e.g. `claude-locator` / skill roots using raw home).
- Dual-backend means **native per backend**, not one portable script.

## From grounding

- Real Claude sample confirmed: `export const meta = { name, description, whenToUse, phases }` in `.js`.
- Home `~/.claude/workflows` missing on survey machine — empty path is real.
- Grok CLI paths confirmed in installed user guide.

## From review / product revision

- Prior “Claude = Grok-only message” is **withdrawn** as product intent.
- Cross-format execution is **non-goal**.

## Accepted limits

- No TOML/config parse for Claude workflow feature flags (unless a plain env var is documented later).
- Workspace-root-only discovery (no nested package `.claude/workflows` crawl) — same class of limit as skills.
- Extension does not run scripts; bad scripts may seed a launch that fails in the CLI.
- Historical Decision 1 in old capability plan remains archive unless T4 notes supersession.

## Resolution

Gate: confirm dual-backend native approach (already requested).  
Implement: resolve Claude invoke + `.ts` acceptance with evidence; record result in progress notes if it diverges from `/workflow <name> `.
