#!/usr/bin/env python3
"""SessionEnd hook: best-effort token capture into `docs/metrics/pending-commit.env`.

`scripts/prepare_commit_metrics.py --from-env` already reads
`docs/metrics/pending-commit.env` (`MODEL`/`INPUT`/`OUTPUT`/`NOTE`) and records
a **measured** ledger row. This hook's job is only to populate that file so the
every-commit ledger ceremony (`docs/plans/grok-harness-improvements.md` OQ4)
stops landing on the honest-unmeasured fallback by default.

Confirmed/observed contract (see `.grok/hooks/README.md` for the full
evidence trail — this is the one part of WP1 that could **not** be fully
confirmed from the CLI's own docs, only inferred from a live session's own
on-disk transcript):
- `SessionEnd`'s stdin envelope is documented to carry the common fields
  (`sessionId`, `cwd`, `workspaceRoot`, ...) but its usage-specific fields are
  *not* documented, and a headless one-shot session in this environment never
  fired `SessionEnd` at all (only `SessionStart`/`PreToolUse`/`PostToolUse`/
  `Stop` were observed — `SessionEnd` appears to require a real interactive
  session teardown).
- What *is* confirmed by directly inspecting a real session's on-disk files:
  Grok writes each session under
  ``<GROK_HOME>/sessions/<url-quote(cwd)>/<sessionId>/updates.jsonl``, and a
  ``turn_completed`` update in that file carries a real
  ``usage.modelUsage`` breakdown (`inputTokens`/`outputTokens` per model id).
  This hook reads that file if `SessionEnd`'s own payload doesn't already
  supply a `transcriptPath` (other events on this CLI do supply one).

Never invents numbers: if the transcript can't be found, read, or parsed for a
`turn_completed` usage block, this hook writes nothing. Never clobbers an
existing pending file — a prior unrecorded commit's data always wins.

**Never writes into a repo that has no consumer.** This hook is bundled with
the Grokbit extension and can be installed into any workspace, but its output
only means something to a repo that runs `scripts/prepare_commit_metrics.py`
(this repo and the GrokForge template). Without that script present, writing
`docs/metrics/pending-commit.env` would silently create a `docs/metrics/`
directory in a stranger's project holding a file nothing ever reads — so the
absence of the consumer is an early, no-op return, checked before any
directory is created.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import _common as hc  # noqa: E402

PENDING_REL = Path("docs") / "metrics" / "pending-commit.env"

# The only script that reads PENDING_REL. Its absence means this workspace has
# no commit-metrics ledger, so there is nothing for this hook to feed.
CONSUMER_REL = Path("scripts") / "prepare_commit_metrics.py"


def has_ledger_consumer(workspace_root: Path) -> bool:
    """True when this repo actually consumes `docs/metrics/pending-commit.env`."""
    return (workspace_root / CONSUMER_REL).is_file()


def transcript_path_from_payload(payload: dict, *, grok_home: Path) -> Path | None:
    """Resolve this session's transcript file.

    Prefers an explicit ``transcriptPath`` field (confirmed present on other
    events on this CLI); falls back to the on-disk session layout confirmed by
    directly inspecting a real session directory.
    """
    explicit = payload.get("transcriptPath")
    if isinstance(explicit, str) and explicit:
        return Path(explicit)
    session_id = payload.get("sessionId")
    cwd = payload.get("cwd") or payload.get("workspaceRoot")
    if not isinstance(session_id, str) or not session_id or not isinstance(cwd, str) or not cwd:
        return None
    encoded = urllib.parse.quote(cwd, safe="")
    return grok_home / "sessions" / encoded / session_id / "updates.jsonl"


def _safe_int(value: object) -> int:
    """Best-effort int conversion for a usage field pulled from an inferred,
    unconfirmed payload shape (see module docstring). A non-numeric or
    list/dict value must be skipped (0), never raise and crash the hook."""
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def extract_model_usage(transcript_text: str) -> dict[str, dict[str, int]]:
    """Aggregate ``turn_completed`` usage entries in a session transcript by model id.

    Defensive against schema drift and non-usage record kinds: skips blank
    lines, invalid JSON, and any record that isn't a well-formed
    ``turn_completed`` update carrying a ``usage.modelUsage`` object.
    """
    totals: dict[str, dict[str, int]] = {}
    for line in transcript_text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(record, dict):
            continue
        update = ((record.get("params") or {}).get("update")) or {}
        if not isinstance(update, dict) or update.get("sessionUpdate") != "turn_completed":
            continue
        usage = update.get("usage")
        model_usage = usage.get("modelUsage") if isinstance(usage, dict) else None
        if not isinstance(model_usage, dict):
            continue
        for model_id, stats in model_usage.items():
            if not isinstance(stats, dict):
                continue
            bucket = totals.setdefault(model_id, {"input_tokens": 0, "output_tokens": 0})
            bucket["input_tokens"] += _safe_int(stats.get("inputTokens"))
            bucket["output_tokens"] += _safe_int(stats.get("outputTokens"))
    return totals


def pick_primary_model(totals: dict[str, dict[str, int]]) -> tuple[str, int, int] | None:
    """Return (model_id, input_tokens, output_tokens) for the model with the
    most total tokens, or ``None`` when there is nothing measured."""
    if not totals:
        return None
    model_id = max(totals, key=lambda m: totals[m]["input_tokens"] + totals[m]["output_tokens"])
    stats = totals[model_id]
    if stats["input_tokens"] == 0 and stats["output_tokens"] == 0:
        return None
    return model_id, stats["input_tokens"], stats["output_tokens"]


def _sanitize_env_value(value: str) -> str:
    """Collapse CR/LF so a value can't inject extra ``KEY=VALUE`` lines into
    `docs/metrics/pending-commit.env` (`prepare_commit_metrics.py` parses it
    line by line, last-wins per key) -- e.g. a `sessionId` containing a
    newline followed by ``MODEL=...`` would otherwise smuggle in a fake row."""
    return value.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")


def build_pending_env(model: str, input_tokens: int, output_tokens: int, note: str = "") -> str:
    lines = [
        f"MODEL={_sanitize_env_value(model)}",
        f"INPUT={input_tokens}",
        f"OUTPUT={output_tokens}",
    ]
    if note:
        lines.append(f"NOTE={_sanitize_env_value(note)}")
    return "\n".join(lines) + "\n"


def main(
    stdin_text: str,
    *,
    workspace_root: Path | None = None,
    grok_home: Path | None = None,
) -> Path | None:
    """Write `docs/metrics/pending-commit.env` when real usage is found.

    Returns the path written, or ``None`` when nothing was written (no ledger
    consumer in this repo, no usage found, transcript missing/unreadable, or a
    pending file already exists).
    """
    payload = hc.parse_event(stdin_text)
    if payload is None:
        return None

    root_str = str(workspace_root) if workspace_root is not None else hc.workspace_root_of(payload)
    if not root_str:
        return None
    root = Path(root_str)

    if not has_ledger_consumer(root):
        return None  # no scripts/prepare_commit_metrics.py — never write into a foreign repo

    pending_path = root / PENDING_REL
    if pending_path.exists():
        return None  # never clobber an existing pending file

    home = grok_home or Path(os.environ.get("GROK_HOME") or (Path.home() / ".grok"))
    transcript = transcript_path_from_payload(payload, grok_home=home)
    if transcript is None or not transcript.is_file():
        return None

    try:
        transcript_text = transcript.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    primary = pick_primary_model(extract_model_usage(transcript_text))
    if primary is None:
        return None
    model, input_tokens, output_tokens = primary

    session_id = payload.get("sessionId") or "unknown-session"
    note = f"grok session {session_id} (auto-captured by record_session_tokens.py)"
    body = build_pending_env(model, input_tokens, output_tokens, note)

    try:
        pending_path.parent.mkdir(parents=True, exist_ok=True)
        pending_path.write_text(body, encoding="utf-8", newline="\n")
    except OSError:
        return None
    return pending_path


def _run() -> int:
    main(sys.stdin.read())
    return 0


if __name__ == "__main__":
    sys.exit(hc.run_safely(_run))
