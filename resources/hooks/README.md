# Bundled Grok harness hooks

This tree is **vendored into the Grokbit vsix** from the GrokForge agentic-team
template (Python `.grok/hooks/`, ADR 0001 lineage). The extension can copy it
into an open workspace as `.grok/hooks/`.

| Path | Role |
|------|------|
| `grok/` | Scripts + `settings.json` wiring for Grok CLI hooks |

## Install (product)

1. Command palette: **Grokbit: Install workspace harness hooks**  
   (or set `grok.hooks.provision` to `workspace` for auto-install on activation).
2. **Have Python on PATH.** Every wired command is `python "<script>.py"`. The
   installer probes for `python` then `python3` and rewrites the copied
   `settings.json` to whichever it found; if neither exists it still installs
   but says so, because a gate that can't start is worse than no gate.
3. Trust the project for hooks: in a Grok session run **`/hooks-trust`** (or
   your CLI’s equivalent). Untrusted project hooks do not fire.
4. Hooks are a **backstop only** — they do not replace `/plan` → `/implement`
   accuracy protocol, coverage, review, or UI verification.

Default for foreign workspaces is **`off`** so Marketplace users never get
surprise workspace writes. Uninstall by deleting `.grok/hooks/`; the extension
never writes anywhere else in your repo.

## What the hooks write

| Hook | Writes |
|------|--------|
| `session_start`, `mark_changed`, `verify_on_stop` | per-session marker/counter files under the OS temp dir (`GROK_HOOKS_STATE_DIR` to relocate) — never in your repo |
| `record_session_tokens` | `docs/metrics/pending-commit.env`, **only** in a repo that has `scripts/prepare_commit_metrics.py` to consume it. Without that script it is a no-op, so installing hooks never creates a `docs/metrics/` directory in a project that has no use for one. |

## Interaction with the Ship pipeline

`grokbit-ship` pauses for human approval after the plan — and the plan wrote
files, so the Stop gate runs Lint + Unit tests before that pause. That is
correct (the marker doesn't distinguish plan artifacts from source) but it
means the checkpoint arrives one full test run later than you might expect.

## What the Stop gate does

When this session changed a file, `verify_on_stop.py` runs **Lint** + **Unit
tests** from `AGENTS.md` Project Test Commands. Red blocks completion (bounded
retries). `TODO`/`NONE` rows fail-open with a stderr note — never a silent
“all green.”

## Dual-stack warning

If both `.grok/hooks/` and Claude hooks (`.claude/hooks/` or hooks in
`.claude/settings.json`) exist, Grok may load **both** under folder trust.
Prefer one stack per session type; see CLAUDE.md Known limits.

## Source

Upstream: GrokForge `grokbuild-dev-team-template` `.grok/hooks/`. Do not invent
token counts in `record_session_tokens.py`.
