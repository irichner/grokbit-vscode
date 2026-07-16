# GrokForge project template (v1.7)

Grok-native paths only. Optimized for **accuracy + coverage + UI design quality** with explicit revise/retry loops.

## What loads automatically

| Path | Loaded by Grok? |
|------|-----------------|
| Root `AGENTS.md` | Yes (project rules) |
| `.grok/rules/*.md` | Yes (incl. spawn checklist + accuracy gates) |
| `.grok/skills/*/SKILL.md` | Yes (skills / slash commands) |
| `.grok/personas/*.toml` | Yes (persona **catalog only**; spawn needs instruction **prepend**) |
| `.grok/roles/*.toml` | Catalog defaults only — **not spawn binding**; skills still set `capability_mode` + prepend |
| `.grok/docs/*`, `.grok/workflows/*` | **No** — reference only (mandatory `read_file` for reviewers/QA/frontend) |

## Prefer bundled skills

- `/implement` — implement → review → fix loop  
- `/review` — diff review  
- `/check-work` — session verification (includes build/test when relevant)  
- `/code-review` — strict maintainability (optional)  
- `/create-skill` — capture new skills  
- `/plan`, `/view-plan` — Plan Mode  

Project skills: **`/plan-review-loop` (default plan critique)**, targeted/regression testing, post-change protocol, parallel fullstack, install-agentic-team.  
**`/cold-review`** is optional and only if present in `grok inspect` (external plugin — not shipped by this template).

## Accuracy loops (v1.7)

| Skill / phase | Loop | Cap |
|---------------|------|-----|
| `/plan-review-loop` (optional `/cold-review`) | revise → re-review | 2 passes |
| `/targeted-unit-test-loop` | fix → re-test | 3 full suite runs |
| `/regression-test-loop` | fix → re-test | 3 full phase runs |
| `/post-change-accuracy-protocol` | full protocol retry | 3 cycles |

## Metrics (every commit)

- `VERSION` patch-bumps on each commit  
- Token / model usage: `docs/metrics/token-ledger.md` via `scripts/prepare_commit_metrics.py`  
- Git hook: `python scripts/install_git_hooks.py`

## Git required for full protocol

`/review` local mode, worktrees, and git-diff coverage need a git repo. Without git: degraded protocol.

## Deprecated

`.grokbuild/` (v1.1) — not discovered.
