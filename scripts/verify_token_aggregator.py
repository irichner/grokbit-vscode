#!/usr/bin/env python3
"""Fixture checks for scripts/aggregate_token_usage.py.

Manually-run tooling, deliberately NOT part of ``npm test`` or CI: both stay
Python-free, and the aggregator is a maintainer-machine tool that only runs at
rebuild/release time (see TESTS.md § Python aggregator).

Everything here reads ``fixtures/token-usage/`` — hand-written records with
small, hand-checkable numbers — and writes only into a temporary directory.
No real transcript is ever touched.

    python scripts/verify_token_aggregator.py
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

import aggregate_token_usage as agg  # noqa: E402

FIXTURES = REPO_ROOT / "fixtures" / "token-usage"
PROJECTS = FIXTURES / "projects"
PROJECTS_REDUCED = FIXTURES / "projects-reduced"
PROJECTS_EMPTY = FIXTURES / "projects-empty"
GROK_SESSIONS = FIXTURES / "grok-sessions"
GROK_EMPTY = FIXTURES / "grok-sessions-absent"  # deliberately does not exist
PROJECT_ROOT = "C:\\fixtures\\grokbit"

EXPECTED_CLAUDE = {"sess-1111": 130, "sess-2222": 250, "sess-3333": 380}
EXPECTED_GROK = {"019f-aaa": 1200, "019f-bbb": 500, "019f-res": 300}
EXPECTED_TOTAL = 2760
EXPECTED_SESSIONS = 6

SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
LEDGER_KEYS = {"schema", "generated_at", "total_tokens", "buckets"}
BUCKET_KEYS = {"accounting", "sessions", "total_tokens", "by_session"}

failures: list = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def full_ledger() -> dict:
    return agg.build_ledger(
        agg.scan_claude_sessions(PROJECTS, PROJECT_ROOT),
        agg.scan_grok_sessions(GROK_SESSIONS, PROJECT_ROOT),
    )


def check_claude_scan() -> None:
    """Streaming dedupe, all four usage fields, nested + workflow subagents,
    same-named subagent files under two parents, descendant cwds, and every
    malformed / non-assistant / out-of-project record being skipped."""
    got = agg.scan_claude_sessions(PROJECTS, PROJECT_ROOT)
    check("claude scan attributes by sessionId", got == EXPECTED_CLAUDE, f"{got} != {EXPECTED_CLAUDE}")


def check_grok_scan() -> None:
    """Case-variant and subdirectory workspace keys resolve to this project;
    a sibling directory whose name merely shares a prefix does not."""
    got = agg.scan_grok_sessions(GROK_SESSIONS, PROJECT_ROOT)
    check("grok scan reads signals.json per session", got == EXPECTED_GROK, f"{got} != {EXPECTED_GROK}")


def check_uri_encoding() -> None:
    """The workspace folder name is produced by JS's encodeURIComponent, whose
    safe set differs from Python's urllib quote()."""
    ok = (
        agg.encode_uri_component("C:\\fixtures\\grokbit") == "C%3A%5Cfixtures%5Cgrokbit"
        and agg.encode_uri_component("a!~*'()-_.b") == "a!~*'()-_.b"
        and agg.encode_uri_component("a b/c") == "a%20b%2Fc"
    )
    check("encode_uri_component matches encodeURIComponent", ok)


def check_project_containment() -> None:
    ok = (
        agg.is_within_project("C:\\fixtures\\grokbit", PROJECT_ROOT)
        and agg.is_within_project("c:\\FIXTURES\\Grokbit\\research", PROJECT_ROOT)
        and not agg.is_within_project("C:\\fixtures\\grokbit-other", PROJECT_ROOT)
        and not agg.is_within_project("C:\\fixtures", PROJECT_ROOT)
        and not agg.is_within_project(None, PROJECT_ROOT)
    )
    check("project containment respects path boundaries", ok)


def check_ledger_shape() -> None:
    ledger = full_ledger()
    buckets = ledger["buckets"]
    ok = (
        set(ledger) == LEDGER_KEYS
        and ledger["schema"] == agg.LEDGER_SCHEMA
        and ledger["total_tokens"] == EXPECTED_TOTAL
        and agg.ledger_session_count(ledger) == EXPECTED_SESSIONS
        and buckets["claude_sessions"]["accounting"] == agg.CLAUDE_ACCOUNTING
        and buckets["grok_sessions"]["accounting"] == agg.GROK_ACCOUNTING
        and buckets["claude_sessions"]["total_tokens"] == 760
        and buckets["grok_sessions"]["total_tokens"] == 2000
        and all(set(b) == BUCKET_KEYS for b in buckets.values())
    )
    check("ledger totals recomputed from the session map", ok, json.dumps(ledger, indent=2))


def check_privacy() -> None:
    """The ledger is committed to a public repo. It must carry ids, integers
    and the two fixed accounting tags — never a prompt, title, model name or
    filesystem path."""
    ledger = full_ledger()
    problems = []
    if set(ledger) != LEDGER_KEYS:
        problems.append(f"unexpected top-level keys: {sorted(set(ledger) - LEDGER_KEYS)}")
    for name, bucket in ledger["buckets"].items():
        if set(bucket) != BUCKET_KEYS:
            problems.append(f"{name}: unexpected keys {sorted(set(bucket) - BUCKET_KEYS)}")
        if bucket["accounting"] not in (agg.CLAUDE_ACCOUNTING, agg.GROK_ACCOUNTING):
            problems.append(f"{name}: free-text accounting tag {bucket['accounting']!r}")
        for session_id, value in bucket["by_session"].items():
            if not SESSION_ID_PATTERN.match(session_id):
                problems.append(f"{name}: session key is not an id: {session_id!r}")
            if not isinstance(value, int) or isinstance(value, bool):
                problems.append(f"{name}: non-integer value for {session_id}: {value!r}")
    serialized = json.dumps(ledger)
    for leak in ("cwd", "\\\\", "/", "prompt", "fixture-model"):
        if leak in serialized:
            problems.append(f"serialized ledger contains {leak!r}")
    check("ledger carries no free text", not problems, "; ".join(problems))


def check_merge_idempotent() -> None:
    ledger = full_ledger()
    merged = agg.merge_ledger(ledger, ledger)
    ok = merged["buckets"] == ledger["buckets"] and merged["total_tokens"] == ledger["total_tokens"]
    check("re-merging an unchanged scan is idempotent", ok)


def check_merge_monotonic() -> None:
    """A pruned transcript set must never lower the committed total."""
    ledger = full_ledger()
    reduced = agg.build_ledger(
        agg.scan_claude_sessions(PROJECTS_REDUCED, PROJECT_ROOT),
        agg.scan_grok_sessions(GROK_EMPTY, PROJECT_ROOT),
    )
    reduced_only = reduced["buckets"]["claude_sessions"]["by_session"]
    merged = agg.merge_ledger(ledger, reduced)
    ok = (
        reduced_only == {"sess-1111": 110}
        and merged["total_tokens"] == EXPECTED_TOTAL
        and merged["buckets"]["claude_sessions"]["by_session"] == EXPECTED_CLAUDE
        and merged["buckets"]["grok_sessions"]["by_session"] == EXPECTED_GROK
    )
    check("merge keeps pruned sessions at their last recorded total", ok, json.dumps(merged, indent=2))


def check_merge_growth() -> None:
    """A session that kept going must lift the total, not be pinned by max."""
    ledger = full_ledger()
    grown = json.loads(json.dumps(ledger))
    grown["buckets"]["claude_sessions"]["by_session"]["sess-1111"] = 999
    grown["buckets"]["claude_sessions"]["by_session"]["sess-new"] = 5
    merged = agg.merge_ledger(ledger, grown)
    ok = (
        merged["buckets"]["claude_sessions"]["by_session"]["sess-1111"] == 999
        and merged["buckets"]["claude_sessions"]["by_session"]["sess-new"] == 5
        and merged["total_tokens"] == EXPECTED_TOTAL - 130 + 999 + 5
    )
    check("merge takes the higher per-session total and new ids", ok, json.dumps(merged, indent=2))


def check_empty_scan_writes_nothing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "token-usage.json"
        ts = Path(tmp) / "token-metrics.ts"
        sentinel = '{"schema": 1, "total_tokens": 4242}\n'
        out.write_text(sentinel, encoding="utf-8")
        code = agg.main(
            [
                "--projects-dir", str(PROJECTS_EMPTY),
                "--grok-sessions-dir", str(GROK_EMPTY),
                "--project", PROJECT_ROOT,
                "--output", str(out),
                "--ts-output", str(ts),
                "--write",
            ]
        )
        ok = code == 0 and out.read_text(encoding="utf-8") == sentinel and not ts.exists()
    check("an empty scan leaves the committed ledger untouched", ok)


def check_write_round_trip() -> None:
    """A real write emits both artefacts, and a second run over the same
    fixtures reproduces them byte-for-byte apart from the timestamp."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "token-usage.json"
        ts = Path(tmp) / "token-metrics.ts"
        args = [
            "--projects-dir", str(PROJECTS),
            "--grok-sessions-dir", str(GROK_SESSIONS),
            "--project", PROJECT_ROOT,
            "--output", str(out),
            "--ts-output", str(ts),
            "--write",
        ]
        agg.main(args)
        first = json.loads(out.read_text(encoding="utf-8"))
        first_ts = ts.read_text(encoding="utf-8")
        agg.main(args)
        second = json.loads(out.read_text(encoding="utf-8"))
        second_ts = ts.read_text(encoding="utf-8")

        def strip_stamp(payload: dict) -> dict:
            copy = dict(payload)
            copy.pop("generated_at", None)
            return copy

        stamp_line = re.compile(r'^export const DEV_TOKENS_GENERATED_AT = ".*";$', re.M)
        ok = (
            first["total_tokens"] == EXPECTED_TOTAL
            and strip_stamp(first) == strip_stamp(second)
            and stamp_line.sub("", first_ts) == stamp_line.sub("", second_ts)
            and f"export const DEV_TOKENS_TOTAL = {EXPECTED_TOTAL};" in first_ts
            and f"export const DEV_TOKENS_SESSIONS = {EXPECTED_SESSIONS};" in first_ts
            and "do not hand-edit" in first_ts
            and "aggregate_token_usage.py" in first_ts
        )
    check("write emits both artefacts and re-runs identically", ok)


def check_generated_module_is_data_only() -> None:
    """The emitted module must stay a plain data module — no imports, no logic
    (the src/session.ts precedent), so it can never fail at runtime."""
    source = agg.render_token_metrics_ts(full_ledger())
    body = [line for line in source.splitlines() if line and not line.startswith("//")]
    ok = all(line.startswith("export const ") and line.endswith(";") for line in body) and len(body) == 3
    check("generated module is data only", ok, "\n".join(body))


def check_transcript_mode_still_works() -> None:
    """The SessionEnd hook calls --transcript; it must keep its old shape.

    Still grouped by ``cwd`` and still counting a record with no ``sessionId``
    (110 + the fixture's synthetic 7777 session-less record) — unlike the
    ledger, which can only attribute what it can key by session. Real
    transcripts always carry a ``sessionId``; the difference is a fixture-only
    defensive case, pinned here so the hook's path is not "tidied" to match.
    """
    report, records = agg.summarize_transcript(PROJECTS / "C--fixtures-grokbit" / "sess-1111.jsonl")
    entry = report.get("c:\\fixtures\\grokbit")
    ok = bool(entry) and entry["total_tokens"] == 7887 and len(records) >= 4
    check("--transcript mode is unchanged", ok, json.dumps(report, indent=2))


def main() -> int:
    checks = [
        check_uri_encoding,
        check_project_containment,
        check_claude_scan,
        check_grok_scan,
        check_ledger_shape,
        check_privacy,
        check_merge_idempotent,
        check_merge_monotonic,
        check_merge_growth,
        check_empty_scan_writes_nothing,
        check_write_round_trip,
        check_generated_module_is_data_only,
        check_transcript_mode_still_works,
    ]
    for fn in checks:
        fn()
    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print(f"all {len(checks)} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
