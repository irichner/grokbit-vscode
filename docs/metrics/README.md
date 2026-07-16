# Project metrics

## Policy (mandatory)

**Every git commit** must update:

1. **`VERSION`** — patch segment bumps (`1.7.0` → `1.7.1` → …) on each commit metrics run  
2. **`docs/metrics/token-ledger.md`** — one new entry for that commit (measured tokens or explicit unmeasured)

Enforced by:

- Lead rule in `AGENTS.md`  
- `scripts/prepare_commit_metrics.py`  
- Git **pre-commit** hook (`python scripts/install_git_hooks.py`)

Never invent token numbers. If session stats are unavailable, use `--unmeasured` (counts stay unchanged; stamp still recorded).

## Before each commit

### Preferred (measured)

```bash
python scripts/prepare_commit_metrics.py \
  --model grok-build \
  --input 12000 \
  --output 4000 \
  --note "implement tags + protocol"
git add VERSION docs/metrics/token-ledger.md
git commit -m "..."
```

With hooks installed, the pre-commit hook always runs prepare and stages the files.
If you commit from a GUI (VS Code/Cursor) without env/pending metrics, the hook
records an **unmeasured** stamp (still bumps `VERSION`) and prints a warning —
it will not invent token numbers.

### Env vars (hook / CI)

```bash
export GROK_MODEL=grok-build
export GROK_INPUT_TOKENS=12000
export GROK_OUTPUT_TOKENS=4000
export GROK_METRICS_NOTE="session work"
git commit -m "..."
```

### Pending file (agents)

Write `docs/metrics/pending-commit.env` (gitignored):

```env
MODEL=grok-build
INPUT=12000
OUTPUT=4000
NOTE=session work
UNMEASURED=0
```

Then `git commit` (hook reads the file).

### Tokens unknown

```bash
python scripts/prepare_commit_metrics.py --unmeasured --note "host did not report usage"
# or
export GROK_TOKENS_UNMEASURED=1
git commit -m "..."
```

### Escape hatch (rare)

```bash
GROK_SKIP_COMMIT_METRICS=1 git commit -m "..."
```

Use only with user approval; record a durable note why.

## Mid-session recording (optional)

Without bumping VERSION:

```bash
python scripts/record_token_usage.py --model grok-build --input 1000 --output 200 --note "targeted loop only"
```

Still run `prepare_commit_metrics` at commit time (may double-count if you re-record the same session — prefer commit-time only, or note partial in Notes).

## Install hooks

```bash
python scripts/install_git_hooks.py
```

`install_agentic_team.py` installs hooks into target git repos when `scripts/githooks/` and `prepare_commit_metrics.py` are present (template copies scripts into target only if you also ship scripts — see installer).

## Install into other projects

Installer seeds `docs/metrics/` (README + ledger if missing). Copy or depend on `scripts/prepare_commit_metrics.py`, `scripts/record_token_usage.py`, and `scripts/githooks/pre-commit` for full enforcement.
