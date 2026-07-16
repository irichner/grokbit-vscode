---
name: install-agentic-team
description: >
  Install GrokForge Agentic Dev Team config (.grok, AGENTS.md, fixtures, waivers)
  into a new or existing project via scripts/install_agentic_team.py.
  Use when asked to install this template, bootstrap agentic team into another repo,
  or /install-agentic-team.
disable-model-invocation: true
---

# Skill: Install Agentic Team

## Prefer

Run the **stdlib installer script** — do not hand-copy files or re-run free-form bootstrap writes.

## Inputs

- **Target path** (required): absolute or repo-relative path to the destination project root.
- Optional flags: `--dry-run`, `--force`, `--write-handoff`, `--verify`, `--no-scan`, `--skip-agents`, `--agents-only`.

## Steps

1. Confirm target path with the user if ambiguous. Installing modifies another tree.
2. Locate the **template repo** that contains `scripts/install_agentic_team.py` (and the source `.grok/` tree).  
   - If the current workspace *is* the template: run from repo root.  
   - If the current workspace is an already-installed product repo: run the script by absolute path, and pass `--source <template-root>` when refreshing.
3. Prefer a dry-run first when the target is a non-empty existing product repo:
   ```bash
   python scripts/install_agentic_team.py <target> --dry-run
   # or from a product repo:
   python <template-root>/scripts/install_agentic_team.py <target> --source <template-root> --dry-run
   ```
4. Install:
   ```bash
   python scripts/install_agentic_team.py <target> --write-handoff --verify
   ```
   Use `--force` only when intentionally refreshing template-owned files that diverged (creates `*.bak-agentic-*` backups).
5. Summarize for the user:
   - `git_mode` (full vs degraded)
   - companion rule files left unchanged (`CLAUDE.md`, etc.)
   - Project Test Commands REAL / NONE / TODO
   - conflicts skipped (if any)
   - handoff path: `docs/plans/agentic-team-install-handoff.md` (when `--write-handoff`)
6. If Coverage or Unit is NONE/TODO: point to durable waiver or filling `AGENTS.md` before claiming accuracy gates are operational.
7. Optional post-install: Fixture A under target (`fixtures/agentic-template-acceptance/bad-plan.md` → `docs/plans/acceptance-bad-plan.md` + `/plan-review-loop`; optional `/cold-review` only if listed in `grok inspect`).

## What it installs

- `.grok/` (rules including spawn checklist + accuracy gates, personas, skills, **all four** role catalog files, docs including plan-quality + test-accuracy + ui-design + coverage-policy, workflows)
- `docs/waivers/README.md` (does not delete existing waivers)
- `docs/metrics/README.md` + seed `docs/metrics/token-ledger.md` **only if missing** (never overwrites usage history)
- `scripts/prepare_commit_metrics.py`, `record_token_usage.py`, `install_git_hooks.py`, `githooks/pre-commit` (every-commit VERSION + tokens)
- Seeds `VERSION` to `0.1.0` if missing; installs pre-commit metrics hook in git targets
- `fixtures/agentic-template-acceptance/` (includes `sample-ui/` for Fixture E)
- Generated root `AGENTS.md` (pipeline, loop policy, scanned Project Test Commands; Coverage prefers pytest-cov + diff-cover when reconstructable)
- Ensures `docs/plans/`, `docs/waivers/`, and `docs/metrics/` directories exist

`--verify` requires core skills, persona instructions, roles, spawn rule, metrics paths, and docs (`plan-quality-standards.md`, `test-accuracy-standards.md`, etc.).

## What it never installs

- Product sample app (`src/taskboard`, template `tests/`, `pyproject.toml`)
- Template bootstrap history under `docs/plans/`

## Capability

Lead/orchestrator needs shell: `capability_mode: execute` or `all` when spawning a helper to run the script. Prefer running the script in the current session.

## Exit

Installer exit code 0 and required paths present under target; handoff summarized. Do not claim Fixture A/B/C passed unless actually run.
