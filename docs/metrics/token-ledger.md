# Token & model usage ledger

**Template version:** 0.1.24  
**Last updated:** 2026-08-02  
**Policy:** update **VERSION** + this ledger on **every git commit** (`scripts/prepare_commit_metrics.py` / pre-commit hook).  
**Source of figures:** session stats (`/context`, `/session-info`, host UI) — never invent.

## Running totals

| Metric | Value |
|--------|------:|
| Total input tokens (measured) | 0 |
| Total output tokens (measured) | 0 |
| Total tokens (measured) | 0 |
| Measured entries | 0 |
| Unmeasured commit stamps | 25 |
| All ledger entries | 25 |

## By model (measured only)

| Model | Input | Output | Total | Entries |
|-------|------:|-------:|------:|--------:|
| *(none yet)* | 0 | 0 | 0 | 0 |

## Entries

| Date (UTC) | Session / label | Model | Input | Output | Total | Notes |
|------------|-----------------|-------|------:|-------:|------:|-------|
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v1.7.1: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.1: mid-turn follow-up send UX + related working tree; host did not report token usage [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.2: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.3: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.4: launcher history cap 7 + office icons moved to activity bar; host did not report token usage [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.5: v2.0.3: launcher history cap 7 + office icons on activity bar; host did not report token usage [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.6: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.7: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-16 | commit-2026-07-16 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.8: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-17 | commit-2026-07-17 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.9: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-20 | commit-2026-07-20 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.10: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-31 | commit-2026-07-31 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.11: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-07-31 | commit-2026-07-31 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.12: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.13: T1 visibleCapabilityGroups pure filter (actions-workflow-tiles) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.14: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.15: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.16: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.17: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.18: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-01 | commit-2026-08-01 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.19: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-02 | commit-2026-08-02 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.20: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-02 | commit-2026-08-02 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.21: T1 changed-files-dedupe: path-aggregate strip [unmeasured] |
| 2026-08-02 | commit-2026-08-02 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.22: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-02 | commit-2026-08-02 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.23: auto unmeasured (no metrics in env/pending file) [unmeasured] |
| 2026-08-02 | commit-2026-08-02 | unmeasured | 0 | 0 | 0 | commit metrics v0.1.24: auto unmeasured (no metrics in env/pending file) [unmeasured] |

<!-- LEDGER_END -->

## Notes

- **Every commit** must refresh VERSION (patch bump) and append a ledger row via `prepare_commit_metrics.py` (enforced by git pre-commit when hooks installed).
- Model `unmeasured` / notes containing `[unmeasured]` do **not** add to token totals.
- Subagent usage: when the host only reports parent-session totals, note that limitation.
- Entries are append-only; corrections use a follow-up entry (negative only if host confirms).
- Keep this file in version control so the team shares one running total.
