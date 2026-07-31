#!/usr/bin/env python3
"""Aggregate per-project Claude Code token usage from local session transcripts.

Source of truth: the JSONL transcripts Claude Code writes under
``~/.claude/projects/<slug>/<session-id>.jsonl`` (plus nested
``<session-id>/subagents/**/agent-*.jsonl`` for subagent threads). Every
assistant record carries the real project path in a top-level ``cwd`` field and
per-response token counts in ``message.usage`` (``input_tokens``,
``output_tokens``, ``cache_read_input_tokens``, ``cache_creation_input_tokens``).

We group usage by the normalized ``cwd`` field, never by the folder slug: the
slug is not a reliable function of the path (the same drive shows up as both
``c--Users-...`` and ``C--Users-...`` depending on how the session was
launched). We also dedupe by ``message.id`` (falling back to ``requestId``,
then a usage fingerprint): streaming responses repeat byte-identical ``usage``
blocks across several consecutive JSONL lines, so summing naively
triple-counts.

Two outputs, two jobs. The *table* (``--print``) is the ad-hoc, all-projects
view over Claude transcripts only. The *ledger* (the default write path) is
this repo's committed development-cost record: ``docs/metrics/token-usage.json``
plus the generated constant ``src/token-metrics.ts`` the extension displays in
its launcher header. The ledger is scoped to one project (``--project``,
default: the repo this script lives in) *and its subdirectories*, adds a second
bucket for grok sessions (``~/.grok/sessions/<encodeURIComponent(cwd)>/*/
signals.json``), is bucketed per **session id**, and is **merged** rather than
overwritten -- see ``merge_ledger``.

Stdlib only. Cross-platform.

Usage (from repo root):
  python scripts/aggregate_token_usage.py --write
      Scan ~/.claude/projects + ~/.grok/sessions for THIS repo, merge into
      docs/metrics/token-usage.json, and regenerate src/token-metrics.ts.
      (Writing is also the default when no other mode flag is given.)

  python scripts/aggregate_token_usage.py --print
      Full scan; render a human-readable table + this repo's ledger to
      stdout. Writes nothing.

  python scripts/aggregate_token_usage.py --transcript path/to/session.jsonl
      Aggregate a single transcript file; print its totals as JSON.

  python scripts/aggregate_token_usage.py --transcript path/to/session.jsonl --append-project-log
      Same, and also append one summary line to that project's
      .claude/logs/token-usage.jsonl (used by the SessionEnd hook).

  python scripts/aggregate_token_usage.py --project "C:\\Users\\me\\Projects\\foo"
      Account for a different project: filters the table exactly, and scopes
      the ledger to that path and its subdirectories.

  python scripts/aggregate_token_usage.py --projects-dir /tmp/fixture-projects
      Override the transcripts root (paired with --grok-sessions-dir,
      --output and --ts-output for tests; see fixtures/token-usage/ and
      scripts/verify_token_aggregator.py).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, Optional
from urllib.parse import unquote

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_PROJECTS_DIR = Path.home() / ".claude" / "projects"
DEFAULT_GROK_SESSIONS_DIR = Path.home() / ".grok" / "sessions"
DEFAULT_OUTPUT_PATH = REPO_ROOT / "docs" / "metrics" / "token-usage.json"
DEFAULT_TS_OUTPUT_PATH = REPO_ROOT / "src" / "token-metrics.ts"

LEDGER_SCHEMA = 1
#: Claude transcripts carry a real per-response ``usage`` object, so its bucket
#: is exact billed tokens. Grok persists no per-turn record on disk -- only
#: ``signals.json``'s current-context proxy -- so its bucket is a lower bound.
#: Both feed the headline total; the difference is recorded, never hidden.
CLAUDE_ACCOUNTING = "billed-per-turn"
GROK_ACCOUNTING = "context-proxy"

#: JavaScript's ``encodeURIComponent`` leaves these unescaped on top of
#: alphanumerics. Python's ``urllib.parse.quote`` has a different safe set, and
#: the grok session directory names are produced by the TypeScript side
#: (``sessionsDirFor``, src/sessions.ts), so the JS rule is the one that matters.
_URI_UNRESERVED = re.compile(r"[A-Za-z0-9\-_.!~*'()]")


def normalize_cwd(cwd: Optional[str]) -> Optional[str]:
    """Normalize a raw ``cwd`` field for stable grouping across sessions.

    Lowercases a leading Windows drive letter and unifies path separators, so
    that the same project reached via a differently-cased drive letter (a
    quirk of how the Claude Code project-slug folders get named) collapses
    into one row. POSIX-looking paths are left with forward slashes.
    """
    if not cwd:
        return cwd
    normalized = cwd.strip()
    is_windows_path = len(normalized) >= 2 and normalized[1] == ":" and normalized[0].isalpha()
    if is_windows_path:
        normalized = normalized[0].lower() + normalized[1:]
        normalized = normalized.replace("/", "\\")
        sep = "\\"
    else:
        normalized = normalized.replace("\\", "/")
        sep = "/"
    while sep * 2 in normalized:
        normalized = normalized.replace(sep * 2, sep)
    if len(normalized) > 3 and normalized.endswith(sep):
        normalized = normalized[:-1]
    return normalized


def encode_uri_component(value: str) -> str:
    """Byte-for-byte equivalent of JavaScript's ``encodeURIComponent``.

    Grok names each workspace's session folder ``encodeURIComponent(cwd)``
    (``sessionsDirFor``, src/sessions.ts), so reproducing the *JS* escape set --
    not Python's ``quote`` default -- is what makes the folder lookup match.
    """
    out = []
    for char in value:
        if _URI_UNRESERVED.fullmatch(char):
            out.append(char)
            continue
        for byte in char.encode("utf-8"):
            out.append(f"%{byte:02X}")
    return "".join(out)


def _path_fold(normalized: str) -> str:
    """Case-fold a normalized path when its filesystem is case-insensitive.

    A Windows path (drive letter) is compared case-insensitively -- the same
    project legitimately shows up as ``c:\\...`` and ``C:\\...`` depending on
    how a session was launched (see RC-6 in
    docs/plans/lifetime-token-counter.md). POSIX paths stay case-sensitive.
    """
    is_windows_path = len(normalized) >= 2 and normalized[1] == ":" and normalized[0].isalpha()
    return normalized.lower() if is_windows_path else normalized


def is_within_project(cwd: Optional[str], project_root: Optional[str]) -> bool:
    """True when *cwd* is the project root or a directory inside it.

    Descendants count: a session run from ``<repo>/research/work-resume`` is
    still development of this repo, and Claude Code files it under its own
    project slug with its own ``cwd``.
    """
    if not cwd or not project_root:
        return False
    left = _path_fold(normalize_cwd(cwd) or "")
    right = _path_fold(normalize_cwd(project_root) or "")
    if not left or not right:
        return False
    if left == right:
        return True
    sep = "\\" if (len(right) >= 2 and right[1] == ":") else "/"
    return left.startswith(right + sep)


def iter_transcript_files(projects_dir: Path) -> Iterator[Path]:
    """Yield every transcript JSONL file under *projects_dir*.

    A plain recursive glob naturally picks up nested subagent transcripts
    (``<session>/subagents/**/agent-*.jsonl``) alongside top-level session
    transcripts -- no special-casing needed to include them.
    """
    if not projects_dir.exists():
        return
    yield from sorted(projects_dir.rglob("*.jsonl"))


def iter_assistant_records(path: Path) -> Iterator[dict]:
    """Yield well-formed assistant usage records from one transcript file.

    Defensive against schema drift and the many non-assistant record kinds a
    transcript can contain (queue operations, user turns, attachments,
    summaries, ...): skips blank lines, invalid JSON, non-dict records,
    records that aren't ``type == "assistant"``, and records missing either
    ``message.usage`` or a top-level ``cwd``. Never raises.
    """
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(record, dict) or record.get("type") != "assistant":
            continue
        message = record.get("message")
        if not isinstance(message, dict):
            continue
        usage = message.get("usage")
        if not isinstance(usage, dict):
            continue
        if not record.get("cwd"):
            continue
        yield record


def dedupe_key(record: dict) -> str:
    """A stable per-API-response key: message.id, else requestId, else a
    usage fingerprint. Streaming emits several JSONL lines per response with
    byte-identical usage, so this key is what collapses them to one count."""
    message = record.get("message") or {}
    message_id = message.get("id")
    if message_id:
        return f"id:{message_id}"
    request_id = record.get("requestId")
    if request_id:
        return f"req:{request_id}"
    usage = message.get("usage") or {}
    fingerprint = json.dumps(usage, sort_keys=True)
    return f"fp:{record.get('sessionId', '')}:{fingerprint}"


def _new_model_bucket() -> dict:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_creation_tokens": 0,
        "total_tokens": 0,
    }


def _new_project_bucket() -> dict:
    return {
        "sessions": set(),
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_creation_tokens": 0,
        "total_tokens": 0,
        "by_model": defaultdict(_new_model_bucket),
    }


def aggregate_records(records: Iterable[dict]) -> dict:
    """Aggregate raw assistant records into per-project totals.

    Dedupes (by ``dedupe_key``) across the whole iterable, so callers can feed
    it records pulled from many transcript files -- including nested subagent
    transcripts -- without double-counting repeated streaming lines. Returns
    a dict keyed by normalized cwd, values holding raw accumulators (a
    ``sessions`` set and a ``by_model`` defaultdict) -- pass through
    ``build_report`` to get the committed JSON shape.
    """
    projects: dict = defaultdict(_new_project_bucket)
    seen: set = set()
    for record in records:
        key = dedupe_key(record)
        if key in seen:
            continue
        seen.add(key)

        cwd = normalize_cwd(record.get("cwd"))
        message = record.get("message") or {}
        usage = message.get("usage") or {}
        model = message.get("model") or "unknown"

        input_tokens = int(usage.get("input_tokens") or 0)
        output_tokens = int(usage.get("output_tokens") or 0)
        cache_read = int(usage.get("cache_read_input_tokens") or 0)
        cache_creation = int(usage.get("cache_creation_input_tokens") or 0)
        total = input_tokens + output_tokens + cache_read + cache_creation

        bucket = projects[cwd]
        session_id = record.get("sessionId")
        if session_id:
            bucket["sessions"].add(session_id)
        bucket["input_tokens"] += input_tokens
        bucket["output_tokens"] += output_tokens
        bucket["cache_read_tokens"] += cache_read
        bucket["cache_creation_tokens"] += cache_creation
        bucket["total_tokens"] += total

        model_bucket = bucket["by_model"][model]
        model_bucket["input_tokens"] += input_tokens
        model_bucket["output_tokens"] += output_tokens
        model_bucket["cache_read_tokens"] += cache_read
        model_bucket["cache_creation_tokens"] += cache_creation
        model_bucket["total_tokens"] += total

    return projects


def scan_projects(projects_dir: Path, project_filter: Optional[str] = None) -> dict:
    """Scan every transcript under *projects_dir* and aggregate by project."""
    records: list = []
    for path in iter_transcript_files(projects_dir):
        records.extend(iter_assistant_records(path))
    projects = aggregate_records(records)
    if project_filter:
        norm_filter = normalize_cwd(project_filter)
        projects = {k: v for k, v in projects.items() if k == norm_filter}
    return projects


# --------------------------------------------------------------------------
# Development-cost ledger (docs/metrics/token-usage.json + src/token-metrics.ts)
# --------------------------------------------------------------------------


def aggregate_sessions(records: Iterable[dict], project_root: str) -> dict:
    """Bucket in-project assistant records by their own ``sessionId``.

    Keyed by the record's ``sessionId`` field, never by the file it was found
    in: a workflow subagent transcript is written under *every* parent session
    that ran it (same filename, three parent directories observed), and each
    copy carries its own parent's ``sessionId`` and its own ``message.id``.
    Those are three real runs, so path-based keying would mis-merge them while
    id-based keying attributes each to the session that paid for it.

    Filtering happens *before* deduping, so the in-project numbers don't depend
    on what unrelated projects happen to live on the same machine.
    """
    by_session: dict = defaultdict(int)
    seen: set = set()
    for record in records:
        if not is_within_project(record.get("cwd"), project_root):
            continue
        session_id = record.get("sessionId")
        if not session_id:
            continue
        key = dedupe_key(record)
        if key in seen:
            continue
        seen.add(key)
        usage = (record.get("message") or {}).get("usage") or {}
        by_session[session_id] += (
            int(usage.get("input_tokens") or 0)
            + int(usage.get("output_tokens") or 0)
            + int(usage.get("cache_read_input_tokens") or 0)
            + int(usage.get("cache_creation_input_tokens") or 0)
        )
    return {sid: total for sid, total in by_session.items() if total > 0}


def scan_claude_sessions(projects_dir: Path, project_root: str) -> dict:
    """Per-session billed totals for *project_root* from Claude transcripts."""
    records: list = []
    for path in iter_transcript_files(projects_dir):
        records.extend(iter_assistant_records(path))
    return aggregate_sessions(records, project_root)


def grok_session_estimate(signals: dict) -> int:
    """Mirror of ``sessionTokenEstimate`` (src/sessions.ts): current context
    plus tokens already dropped by compaction. The two must stay a documented
    pair -- this is the best durable signal grok writes to disk, and it is a
    lower bound on tokens actually spent (each turn re-sends the context)."""
    total = 0
    for field in ("contextTokensUsed", "totalTokensBeforeCompaction"):
        value = signals.get(field)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        if value != value or value in (float("inf"), float("-inf")):  # NaN / inf
            continue
        total += max(0, int(value))
    return total


def scan_grok_sessions(sessions_dir: Path, project_root: str) -> dict:
    """Per-session context-proxy totals for *project_root* from grok's
    ``~/.grok/sessions/<encodeURIComponent(cwd)>/<id>/signals.json``.

    The folder name is decoded and compared as a path rather than matched as a
    string, so a case-variant drive letter (which Windows collapses onto one
    physical directory) resolves to the same project.
    """
    by_session: dict = {}
    if not sessions_dir.exists():
        return by_session
    try:
        workspaces = sorted(p for p in sessions_dir.iterdir() if p.is_dir())
    except OSError:
        return by_session
    for workspace in workspaces:
        if not is_within_project(unquote(workspace.name), project_root):
            continue
        try:
            session_dirs = sorted(p for p in workspace.iterdir() if p.is_dir())
        except OSError:
            continue
        for session_dir in session_dirs:
            signals_path = session_dir / "signals.json"
            try:
                signals = json.loads(signals_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(signals, dict):
                continue
            estimate = grok_session_estimate(signals)
            if estimate > 0:
                by_session[session_dir.name] = estimate
    return by_session


def _coerce_count(value) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    if value != value or value in (float("inf"), float("-inf")):
        return 0
    return max(0, int(value))


def _ledger_bucket(accounting: str, by_session: dict) -> dict:
    clean = {sid: _coerce_count(v) for sid, v in by_session.items()}
    clean = {sid: v for sid, v in clean.items() if v > 0}
    return {
        "accounting": accounting,
        "sessions": len(clean),
        "total_tokens": sum(clean.values()),
        "by_session": dict(sorted(clean.items())),
    }


def build_ledger(claude_by_session: dict, grok_by_session: dict) -> dict:
    """The committed ledger shape. Ids, integers and two fixed accounting
    tags -- deliberately no free text: no prompts, no titles, no file paths,
    nothing that could leak transcript content into a public repo."""
    buckets = {
        "claude_sessions": _ledger_bucket(CLAUDE_ACCOUNTING, claude_by_session),
        "grok_sessions": _ledger_bucket(GROK_ACCOUNTING, grok_by_session),
    }
    return {
        "schema": LEDGER_SCHEMA,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_tokens": sum(b["total_tokens"] for b in buckets.values()),
        "buckets": buckets,
    }


def ledger_session_count(ledger: dict) -> int:
    return sum(b.get("sessions", 0) for b in (ledger.get("buckets") or {}).values())


def load_ledger(path: Path) -> Optional[dict]:
    """Read the committed ledger, or None when it is absent/unreadable."""
    try:
        existing = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return existing if isinstance(existing, dict) else None


def merge_ledger(existing: Optional[dict], computed: dict) -> dict:
    """Union of session ids, per-session ``max``, totals recomputed from the map.

    A blind overwrite would reproduce, one layer up, the exact bug this whole
    change removes: transcripts get pruned and a second maintainer's machine
    holds a different subset, so a full recompute can silently *lower* a
    committed public number. ``max`` per session id makes the merge idempotent
    (an unchanged session recomputes to the same value), monotonic (a pruned
    transcript keeps its last recorded total), growing (a continued session's
    higher total wins) and mergeable across machines (a git conflict resolves
    per session id rather than on one opaque total).
    """
    merged_buckets: dict = {}
    for name, accounting in (
        ("claude_sessions", CLAUDE_ACCOUNTING),
        ("grok_sessions", GROK_ACCOUNTING),
    ):
        previous = ((existing or {}).get("buckets") or {}).get(name) or {}
        current = (computed.get("buckets") or {}).get(name) or {}
        by_session: dict = {}
        for source in (previous.get("by_session") or {}, current.get("by_session") or {}):
            if not isinstance(source, dict):
                continue
            for session_id, value in source.items():
                count = _coerce_count(value)
                if count > by_session.get(session_id, 0):
                    by_session[session_id] = count
        merged_buckets[name] = _ledger_bucket(
            current.get("accounting") or previous.get("accounting") or accounting,
            by_session,
        )
    return {
        "schema": LEDGER_SCHEMA,
        "generated_at": computed.get("generated_at")
        or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_tokens": sum(b["total_tokens"] for b in merged_buckets.values()),
        "buckets": merged_buckets,
    }


TS_HEADER = """// GENERATED FILE -- do not hand-edit.
// Regenerate with `npm run metrics:tokens` (scripts/aggregate_token_usage.py),
// which also rewrites the ledger it is derived from, docs/metrics/token-usage.json.
//
// The aggregated cost of DEVELOPING Grokbit: every token every maintainer has
// spent, in any agent session, changing this repository. It is a build-time
// constant baked into the vsix, identical for every user, and no user's own
// activity can move it -- the extension performs no token computation at all.
// Not the context donut, not the status-bar percentage (those are the active
// session's own context and are a different quantity entirely).
"""


def render_token_metrics_ts(ledger: dict) -> str:
    """Render the generated TypeScript constant module. Data only, no logic."""
    total = _coerce_count(ledger.get("total_tokens"))
    generated_at = str(ledger.get("generated_at") or "")
    sessions = ledger_session_count(ledger)
    return (
        TS_HEADER
        + "\n"
        + f"export const DEV_TOKENS_TOTAL = {total};\n"
        + f"export const DEV_TOKENS_GENERATED_AT = {json.dumps(generated_at)};\n"
        + f"export const DEV_TOKENS_SESSIONS = {sessions};\n"
    )


def print_ledger(ledger: dict, project_root: str) -> None:
    print(f"development-token ledger for {project_root}")
    for name, bucket in (ledger.get("buckets") or {}).items():
        print(
            f"  {name:<16} {bucket.get('sessions', 0):>5} sessions "
            f"{bucket.get('total_tokens', 0):>14} tokens  ({bucket.get('accounting')})"
        )
    print(f"  {'TOTAL':<16} {ledger_session_count(ledger):>5} sessions "
          f"{_coerce_count(ledger.get('total_tokens')):>14} tokens")


def build_report(projects: dict) -> dict:
    """Convert the internal aggregation (sets/defaultdicts) into the
    committed JSON shape: {cwd: {sessions, input_tokens, ..., by_model, last_updated}}."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = {}
    for cwd, bucket in sorted(projects.items()):
        report[cwd] = {
            "sessions": len(bucket["sessions"]),
            "input_tokens": bucket["input_tokens"],
            "output_tokens": bucket["output_tokens"],
            "cache_read_tokens": bucket["cache_read_tokens"],
            "cache_creation_tokens": bucket["cache_creation_tokens"],
            "total_tokens": bucket["total_tokens"],
            "by_model": {model: dict(vals) for model, vals in sorted(bucket["by_model"].items())},
            "last_updated": now,
        }
    return report


def write_json(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_text(payload: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(payload, encoding="utf-8")


def print_report(report: dict) -> None:
    if not report:
        print("No token usage recorded.")
        return
    header = (
        f"{'project':<60} {'sessions':>8} {'input':>10} {'output':>10} "
        f"{'cache_read':>12} {'cache_create':>12} {'total':>12}"
    )
    print(header)
    print("-" * len(header))
    grand_total = 0
    ranked = sorted(report.items(), key=lambda kv: kv[1]["total_tokens"], reverse=True)
    for cwd, entry in ranked:
        print(
            f"{cwd:<60} {entry['sessions']:>8} {entry['input_tokens']:>10} "
            f"{entry['output_tokens']:>10} {entry['cache_read_tokens']:>12} "
            f"{entry['cache_creation_tokens']:>12} {entry['total_tokens']:>12}"
        )
        grand_total += entry["total_tokens"]
    print("-" * len(header))
    print(f"{'TOTAL':<60} {'':>8} {'':>10} {'':>10} {'':>12} {'':>12} {grand_total:>12}")


def append_project_log(cwd: str, entry: dict, session_id: Optional[str], model: str) -> Optional[Path]:
    """Append one summary line to <project>/.claude/logs/token-usage.jsonl.

    Best-effort: if the project directory no longer exists or the log dir
    can't be created/written, returns None without raising.
    """
    project_dir = Path(cwd)
    if not project_dir.exists():
        return None
    log_dir = project_dir / ".claude" / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None
    log_path = log_dir / "token-usage.jsonl"
    line = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "session_id": session_id,
        "model": model,
        "input": entry["input_tokens"],
        "output": entry["output_tokens"],
        "cache_read": entry["cache_read_tokens"],
        "cache_create": entry["cache_creation_tokens"],
        "total": entry["total_tokens"],
    }
    try:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(line, sort_keys=True) + "\n")
    except OSError:
        return None
    return log_path


def _combine_entries(report: dict) -> Optional[dict]:
    """Collapse a (normally single-project) transcript report into one entry."""
    entries = list(report.values())
    if not entries:
        return None
    combined = {
        "sessions": sum(e.get("sessions", 0) for e in entries),
        "input_tokens": sum(e.get("input_tokens", 0) for e in entries),
        "output_tokens": sum(e.get("output_tokens", 0) for e in entries),
        "cache_read_tokens": sum(e.get("cache_read_tokens", 0) for e in entries),
        "cache_creation_tokens": sum(e.get("cache_creation_tokens", 0) for e in entries),
        "total_tokens": sum(e.get("total_tokens", 0) for e in entries),
        "by_model": {},
    }
    for e in entries:
        for model, stats in (e.get("by_model") or {}).items():
            slot = combined["by_model"].setdefault(model, {})
            for key, value in stats.items():
                if isinstance(value, int):
                    slot[key] = slot.get(key, 0) + value
    return combined


def _primary_model(entry: dict) -> str:
    by_model = entry.get("by_model") or {}
    if not by_model:
        return "unknown"
    return max(by_model.items(), key=lambda kv: kv[1]["total_tokens"])[0]


def summarize_transcript(path: Path) -> tuple[dict, list]:
    """Aggregate one transcript file. Returns (report, raw_records)."""
    records = list(iter_assistant_records(path))
    projects = aggregate_records(records)
    return build_report(projects), records


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Aggregate per-project Claude Code token usage from local session transcripts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--projects-dir",
        type=Path,
        default=DEFAULT_PROJECTS_DIR,
        help="Override the Claude Code projects root (default: ~/.claude/projects). Mainly for tests.",
    )
    parser.add_argument(
        "--grok-sessions-dir",
        type=Path,
        default=DEFAULT_GROK_SESSIONS_DIR,
        help="Override the grok sessions root (default: ~/.grok/sessions). Mainly for tests.",
    )
    # Read-only vs. write are the two ledger modes; asking for both is a
    # contradiction, so argparse rejects it rather than silently picking one.
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--print",
        dest="print_table",
        action="store_true",
        help="Render a human-readable table to stdout instead of writing the JSON report.",
    )
    mode.add_argument(
        "--write",
        action="store_true",
        help=(
            "Merge the scan into the committed ledger and regenerate src/token-metrics.ts. "
            "This is also the default when neither --print nor --transcript is given."
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Override the ledger path (default: docs/metrics/token-usage.json). Mainly for tests.",
    )
    parser.add_argument(
        "--ts-output",
        type=Path,
        default=DEFAULT_TS_OUTPUT_PATH,
        help="Override the generated constant path (default: src/token-metrics.ts). Mainly for tests.",
    )
    parser.add_argument(
        "--transcript",
        type=Path,
        default=None,
        help="Aggregate a single transcript file instead of scanning --projects-dir.",
    )
    parser.add_argument(
        "--append-project-log",
        action="store_true",
        help=(
            "Append one JSONL summary line to the project's .claude/logs/token-usage.jsonl. "
            "Requires --transcript."
        ),
    )
    parser.add_argument(
        "--project",
        default=None,
        help=(
            "Project path to account for (compared after cwd normalization). Filters the "
            "--print table exactly; scopes the ledger to that path and its subdirectories. "
            "Defaults to the repo this script lives in."
        ),
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=None,
        help=(
            "With --append-project-log: write the log under this project directory "
            "instead of trusting the transcript's recorded cwd for the destination."
        ),
    )
    return parser


def main(argv: Optional[list] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.append_project_log and not args.transcript:
        parser.error("--append-project-log requires --transcript")

    if args.transcript:
        if not args.transcript.exists():
            print(f"error: transcript not found: {args.transcript}", file=sys.stderr)
            return 1

        report, records = summarize_transcript(args.transcript)

        if args.append_project_log:
            if args.project_dir is not None:
                combined = _combine_entries(report)
                if combined is not None:
                    session_id = next((r.get("sessionId") for r in records if r.get("sessionId")), None)
                    append_project_log(
                        str(args.project_dir), combined, session_id, _primary_model(combined)
                    )
            else:
                for cwd, entry in report.items():
                    session_id = next(
                        (
                            r.get("sessionId")
                            for r in records
                            if normalize_cwd(r.get("cwd")) == cwd and r.get("sessionId")
                        ),
                        None,
                    )
                    append_project_log(cwd, entry, session_id, _primary_model(entry))

        if args.print_table:
            print_report(report)
        else:
            print(json.dumps(report, indent=2, sort_keys=True))
        return 0

    project_root = normalize_cwd(args.project or str(REPO_ROOT)) or str(REPO_ROOT)
    computed = build_ledger(
        scan_claude_sessions(args.projects_dir, project_root),
        scan_grok_sessions(args.grok_sessions_dir, project_root),
    )

    if args.print_table:
        print_report(build_report(scan_projects(args.projects_dir, project_filter=args.project)))
        print()
        print_ledger(computed, project_root)
        return 0

    # Never write zeros over real history: a machine with no transcripts (a CI
    # box, a fresh clone, a second maintainer who has not run any agent here)
    # must leave the committed ledger exactly as it is.
    if ledger_session_count(computed) == 0:
        print(
            f"warning: no sessions found for {project_root} "
            f"(claude: {args.projects_dir}, grok: {args.grok_sessions_dir}); "
            f"leaving {args.output} unchanged",
            file=sys.stderr,
        )
        return 0

    merged = merge_ledger(load_ledger(args.output), computed)
    write_json(merged, args.output)
    write_text(render_token_metrics_ts(merged), args.ts_output)
    print(
        f"wrote {ledger_session_count(merged)} session(s), "
        f"{merged['total_tokens']} tokens to {args.output} and {args.ts_output}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
