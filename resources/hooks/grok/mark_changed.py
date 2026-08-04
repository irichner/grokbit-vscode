#!/usr/bin/env python3
"""PostToolUse hook: record that this session touched a file.

Wired (see `.grok/hooks/settings.json`) with ``matcher: "write|search_replace"``
— the two real Grok tool names confirmed to carry file edits (Claude-style
`Edit`/`Write`/`MultiEdit` matchers alias to `search_replace`, but a live
probe against this CLI showed whole-file creation goes through a separate
`write` tool; both carry `toolInput.file_path`). `verify_on_stop.py` only runs
the gate commands when this marker is present, so a turn that never touched a
file (pure Q&A) doesn't trigger a test run.

Fail-open: malformed/empty stdin, or a payload missing `sessionId`, is a no-op
(exit 0) rather than an error.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import _common as hc  # noqa: E402

CHANGE_TOOL_NAMES = frozenset({"write", "search_replace"})


def should_mark(tool_name: str | None) -> bool:
    return tool_name in CHANGE_TOOL_NAMES


def main(stdin_text: str, *, state_base: Path | None = None) -> bool:
    """Mark this session changed when applicable. Returns whether it marked."""
    payload = hc.parse_event(stdin_text)
    if payload is None:
        return False
    session_id = hc.session_id_of(payload)
    if not session_id:
        return False
    if not should_mark(payload.get("toolName")):
        return False
    hc.mark_changed(session_id, base=state_base)
    return True


def _run() -> int:
    main(sys.stdin.read())
    return 0


if __name__ == "__main__":
    sys.exit(hc.run_safely(_run))
