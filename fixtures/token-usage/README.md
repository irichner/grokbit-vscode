# `fixtures/token-usage/` — aggregator fixtures

Synthetic input for `scripts/aggregate_token_usage.py`. **No real transcript content
lives here** — every record is hand-written, every number is small enough to check by
hand, and no fixture holds prose beyond the words on this page.

Run the checks:

```bash
python scripts/verify_token_aggregator.py
```

That script asserts the expected numbers below. It is **not** part of `npm test` and
not part of CI (both stay Python-free) — see `TESTS.md § Python aggregator`.

For an eyeball view of the same tree:

```bash
python scripts/aggregate_token_usage.py \
  --projects-dir fixtures/token-usage/projects \
  --grok-sessions-dir fixtures/token-usage/grok-sessions \
  --project "C:\\fixtures\\grokbit" --print
```

## Layout

| Path | Role |
|---|---|
| `projects/` | A Claude Code transcripts root (`~/.claude/projects` stand-in). |
| `projects-reduced/` | The same root with most transcripts *missing* — proves the merge is monotonic (a pruned transcript must not lower the committed total). |
| `projects-empty/` | An empty root — proves an empty scan writes nothing at all. |
| `grok-sessions/` | A grok sessions root (`~/.grok/sessions` stand-in), keyed by `encodeURIComponent(cwd)`. |

The fixture project root is `C:\fixtures\grokbit`.

## Expected totals

Claude bucket (billed per turn — `input + output + cache_read + cache_creation`):

| Session | Total | Why |
|---|---|---|
| `sess-1111` | 130 | 100 from a 3-line streaming response counted **once** (same `message.id`), + 10 from a second response, + 20 from a nested `subagents/agent-aaa.jsonl`. The blank line, the malformed line, the `type:"user"` record, the record with no `cwd`, the record with no `message.usage`, the record with no `sessionId`, and the record whose `cwd` is the sibling directory `C:\fixtures\grokbit-other` all contribute nothing. |
| `sess-2222` | 250 | 200 from a session whose `cwd` is a **subdirectory** of the project root, + 50 from `subagents/workflows/wf_1/agent-shared.jsonl`. |
| `sess-3333` | 380 | 300 + 20 from a duplicate pair that has **no `message.id`** (deduped by `requestId`) + 60 from a *same-named* `subagents/workflows/wf_1/agent-shared.jsonl` under a different parent — proof that attribution follows each record's own `sessionId`, not the file path. |
| **total** | **760** | |

grok bucket (context proxy — `contextTokensUsed + totalTokensBeforeCompaction`):

| Session | Total | Why |
|---|---|---|
| `019f-aaa` | 1200 | 1000 + 200. |
| `019f-bbb` | 500 | No `totalTokensBeforeCompaction` field. |
| `019f-res` | 300 | Lives under a **lower-cased, subdirectory** workspace key — both variants must resolve to this project. |
| **total** | **2000** | `019f-ccc` (malformed), `019f-ddd` (zero), `019f-eee` (no `signals.json`) and the whole `C%3A%5Cfixtures%5Cgrokbit-other` workspace contribute nothing. |

Ledger headline: **2760 tokens across 6 sessions.**

Reduced set: `sess-1111` alone, worth **110** (its subagent transcript is gone) — merging
that over the full ledger must still yield 2760.
