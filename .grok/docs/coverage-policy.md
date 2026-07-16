# Coverage Policy

- Default gate: **≥ 80%** new/changed executable lines when Coverage command is real in AGENTS.md.
- Measurement ladder — record which rung was used in the QA report:
  1. **changed-line %** via diff-cover or equivalent (preferred; this template installs `diff-cover` in dev deps)
  2. **changed-file %** proxy (files touched must meet threshold or be listed as gaps)
  3. **whole-package %** — weakest; only with an explicit limitation note
- No tool: `NO COVERAGE TOOL` → durable waiver in `docs/waivers/` or add tooling before merge.
- Never invent percentages; use **UNMEASURED** if the tool ran but delta cannot be computed.

## Vacuous / empty diff (mandatory)

If diff-cover (or equivalent) reports **“No lines with coverage information in this diff”** (or 0 relevant lines):

- Record coverage as **`UNMEASURED / no changed lines`** (or equivalent).
- **Do not** treat exit 0 as “100% changed-line coverage” or “gate met at 100%.”
- Whole-package backstop (e.g. `fail_under` in coverage config) may still apply when that command ran.
- On a branch with real product diffs, an empty changed-line report is a tooling/path mismatch until diagnosed (path roots, wrong compare branch, XML not matching tree).

## Compare branch

- Prefer **`origin/main`** (diff-cover public default family).  
- Fallback ladder when the preferred ref is missing: `origin/main` → `main` → `master` → record **UNMEASURED** + note missing base ref (do not invent a branch).  
- In CI: `git fetch` the base ref before running diff-cover.

## Recipe hints

- Python: `pytest --cov … --cov-report=xml` then  
  `python -m diff_cover.diff_cover_tool coverage.xml --compare-branch=origin/main --fail-under=80`  
  (CLI form `diff-cover coverage.xml …` is equivalent when on PATH.)
- JS/TS: vitest/jest --coverage or nyc; prefer changed files if supported
- Go: go test -coverprofile + go tool cover

## Other

- Waivers: scope, residual risk, follow-up, expiry.
- Not a substitute for test accuracy or `/review`.
- Targeted loop must record coverage gate met / waived / NO TOOL / UNMEASURED each cycle.
