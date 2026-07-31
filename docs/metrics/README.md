# Project metrics

Two unrelated ledgers live in this directory. Don't wire one into the other.

| File | What it is |
|---|---|
| `token-usage.json` | The **development-token ledger** — the aggregated cost of building Grokbit, and the source of the `N tokens` figure in the extension's activity-bar launcher. Generated. See below. |
| `token-ledger.md` | The **per-commit metrics stamp** (agentic-template convention, paired with `VERSION`). Hand/hook-written, one entry per commit. See § Policy. |

---

## Development-token ledger (`token-usage.json`)

Every token every maintainer has spent, in any agent session, changing this
repository. It is aggregated at dev time, committed to this public repo, and
baked into the extension as a generated constant.

```
~/.claude/projects/<slug>/**.jsonl   ─┐
~/.grok/sessions/<enc-cwd>/*/signals ─┤→ scripts/aggregate_token_usage.py
                                      │        ├→ docs/metrics/token-usage.json  (this ledger)
                                      │        └→ src/token-metrics.ts           (generated constant)
                                      │                    │
                                      │            tsc → out/token-metrics.js → shipped in the vsix
                                      └────────────  src/sidebar.ts posts it to the launcher header
```

Regenerate with:

```bash
npm run metrics:tokens      # python scripts/aggregate_token_usage.py --write
```

Idempotent, safe to run any time. The rebuild scripts (`scripts/install.ps1`,
`scripts/install.sh`) run it automatically after the version bump and before
packaging — **non-fatally**, so a missing Python or an aggregator error can
never block a rebuild or a release; the committed constant simply stays put.

### It IS the launcher's `N tokens` line

This is a reversal of the original framing. That line used to be a per-workspace
estimate summed from grok's on-disk `signals.json` at runtime — the wrong
quantity (current *context*, not tokens spent), measured on the wrong machine
(the user's), and structurally able to go **down** when sessions were deleted.
The shipped extension now performs no token computation at all: it displays this
ledger's total, identical for every user, and **no user's activity can move it**.

Three different token surfaces, three different jobs — never conflate them:

| Surface | Quantity | Source |
|---|---|---|
| Launcher `N tokens` | Grokbit's **development cost** | this ledger, baked in at package time |
| Composer context donut | the **active session's** current context | live `_meta.totalTokens` |
| Status-bar `%` | the active session's context vs. its model window | live `_meta.totalTokens` |

### Two buckets, two accountings

| Bucket | Source | Accounting | Fidelity |
|---|---|---|---|
| `claude_sessions` | `~/.claude/projects/<slug>/**.jsonl` | `input + output + cache_read + cache_creation`, per assistant record, deduped by `message.id` | **exact** billed tokens |
| `grok_sessions` | `~/.grok/sessions/<enc-cwd>/*/signals.json` | `contextTokensUsed + totalTokensBeforeCompaction` | **lower bound** — grok persists no per-turn record on disk, so this under-reports |

Both feed the headline total. The grok under-report is a documented
approximation, not a hidden fudge — and strictly better than excluding grok
development entirely. `grok_session_estimate` in the aggregator is a deliberate
mirror of `sessionTokenEstimate` in `src/sessions.ts`; change one, change both.

### It is merged, never overwritten

Records are bucketed by their own `sessionId` — never by the file they were
found in, since a workflow subagent transcript is written under *every* parent
session that ran it. Each write is a **union of session ids with a per-session
`max`**, and the headline total is recomputed from the merged map. That makes it
idempotent, monotonic (a pruned transcript keeps its last recorded total),
growing, and mergeable across maintainers' machines — a git conflict resolves
per session id rather than on one opaque total. A scan that finds nothing writes
nothing at all.

### Privacy — the hard rule

**Transcripts are never committed.** `~/.claude/projects/**` and
`~/.grok/sessions/**` hold full conversation content, file contents and paths.
They live outside the repo and stay there. Only the *aggregate* is committed,
and the aggregate carries **no free text**: session ids, integers, and two fixed
accounting tags. No prompts, no titles, no model names, no filesystem paths.
`scripts/verify_token_aggregator.py` asserts exactly that; re-run it (and eyeball
the diff) if you ever change the ledger's shape.

`.claude/logs/**` stays gitignored (`.gitignore`) — it is machine-local derived
data.

### The `SessionEnd` hook is a local mirror, not an input

`.claude/hooks/record-session-tokens.sh` appends one summary line per session to
the gitignored `.claude/logs/token-usage.jsonl`. It is a convenience breadcrumb
for eyeballing a single session's cost without a full scan. It is **explicitly
not** an input to this ledger — it only holds sessions recorded since the hook
was added, and a session's line counts only its top-level transcript, not the
subagent threads that session spawned (which is why a hook line can be an order
of magnitude below the ledger's figure for the same session id). Never wire the
partial log into the total.

### Verifying the aggregator

```bash
python scripts/verify_token_aggregator.py
```

Fixture-driven, stdlib-only, manually run. Not in `npm test`, not in CI — both
stay Python-free. See `TESTS.md § Python aggregator` and `fixtures/token-usage/`.

---

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
