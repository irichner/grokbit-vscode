#!/usr/bin/env python3
"""PreToolUse hook: block writes to secrets, VCS internals, and the hook layer.

Wired (see `.grok/hooks/settings.json`) with ``matcher: "write|search_replace"``
— confirmed on this CLI to be the two tools that create/modify file content;
both carry the target path at ``toolInput.file_path`` (same key Claude uses).

Contract (confirmed against the installed CLI's own docs, see
`.grok/hooks/README.md`): a `PreToolUse` hook denies by printing
``{"decision": "deny", "reason": ...}`` to stdout, which is honored regardless
of exit code; we also exit 2 and repeat the reason on stderr so a block still
takes effect even if some future runtime only trusts the exit-code fallback.

Fail-open: malformed/empty stdin, or a payload with no ``toolInput.file_path``,
allows (exit 0) — this hook only ever blocks on an explicit pattern match.

Path matching is normalization-first and case-insensitive: ``\\`` -> ``/``,
then ``posixpath.normpath`` collapses ``./`` and ``//`` segments, and every
pattern carries ``re.IGNORECASE``. This repo's primary platform (Windows) has
a case-insensitive filesystem, so ``.grok/Hooks/x.py`` and ``.grok/hooks/x.py``
are the same real file; a case-sensitive match would be a trivial bypass.
Over-blocking on a case-sensitive filesystem (POSIX) is the deliberately
accepted, correct-direction tradeoff.

`AGENTS.md` is protected too: it is the Stop gate's own command source
(`verify_on_stop.py` reads Project Test Commands from it), so an agent
deleting the `PROJECT_TEST_COMMANDS` markers or flipping a row to `NONE`
would otherwise be able to silently neuter the gate through an ordinary edit.
This means AGENTS.md becomes human-edit-only once hooks are enabled — a
disclosed, deliberate tradeoff (see `.grok/hooks/README.md`).
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import _common as hc  # noqa: E402

# Patterns are matched against the normalized path (see normalize_path()),
# case-insensitively.
PROTECTED_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(^|/)\.env($|\.)", re.IGNORECASE),
    re.compile(r"\.pem$", re.IGNORECASE),
    re.compile(r"\.key$", re.IGNORECASE),
    re.compile(r"(^|/)secrets?/", re.IGNORECASE),
    re.compile(r"(^|/)\.git/", re.IGNORECASE),
    re.compile(r"(^|/)\.ssh/", re.IGNORECASE),
    re.compile(r"(^|/)id_rsa", re.IGNORECASE),
    re.compile(r"(^|/)\.grok/hooks/", re.IGNORECASE),
    re.compile(r"(^|/)\.grok/settings\.json$", re.IGNORECASE),
    re.compile(r"(^|/)AGENTS\.md$", re.IGNORECASE),
)


def normalize_path(file_path: str) -> str:
    """Normalize a tool-reported path for robust, bypass-resistant matching:
    backslash -> forward slash, then collapse ``./``/``//``/``..`` segments
    with POSIX semantics regardless of host OS (``posixpath.normpath`` always
    uses ``/``, unlike ``os.path.normpath`` on Windows) so
    ``.grok/./hooks/x.py`` and ``.grok//hooks/x.py`` match exactly like
    ``.grok/hooks/x.py``."""
    return posixpath.normpath(file_path.replace("\\", "/"))


def matched_pattern(file_path: str) -> str | None:
    """Return the first matching pattern's source, or ``None`` if unprotected."""
    normalized = normalize_path(file_path)
    for pattern in PROTECTED_PATTERNS:
        if pattern.search(normalized):
            return pattern.pattern
    return None


def decide(payload: dict) -> tuple[int, str | None, str | None]:
    """Return (exit_code, stdout_json_or_none, stderr_reason_or_none)."""
    tool_input = payload.get("toolInput")
    file_path = tool_input.get("file_path") if isinstance(tool_input, dict) else None
    if not isinstance(file_path, str) or not file_path:
        return 0, None, None
    pattern = matched_pattern(file_path)
    if pattern is None:
        return 0, None, None
    reason = (
        f"Blocked by protect_paths.py: '{file_path}' matches protected pattern /{pattern}/. "
        "Secrets, VCS internals, and the enforcement layer itself must be edited by a "
        "human, not the agent."
    )
    return 2, json.dumps({"decision": "deny", "reason": reason}), reason


def main(stdin_text: str) -> tuple[int, str | None, str | None]:
    payload = hc.parse_event(stdin_text)
    if payload is None:
        return 0, None, None
    return decide(payload)


def _run() -> int:
    code, out, err = main(sys.stdin.read())
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(hc.run_safely(_run))
