"""Shared helpers for GrokForge Grok hooks (`.grok/hooks/*.py`).

Stdlib only. Every hook script keeps its real logic in pure, importable
functions and uses these helpers only for the thin I/O shell (stdin parsing,
per-session state files). See `.grok/hooks/README.md` for the confirmed hook
contract (discovery path, JSON shape, event names, stdin/stdout envelope,
exit-code semantics) this module and its siblings were written against.

Fail-open by design: `parse_event` returns ``None`` on anything that isn't a
well-formed JSON object instead of raising, and `run_safely` catches any
unexpected exception from a hook's `_run()` shell so a broken hook can never
wedge a session.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Callable

# Overridable in tests (and by an operator) so state files never depend on the
# real OS temp directory.
STATE_DIR_ENV = "GROK_HOOKS_STATE_DIR"

_SAFE_KEY_RE = re.compile(r"[^A-Za-z0-9_-]")


def parse_event(text: str) -> dict | None:
    """Parse a hook's stdin payload. Returns ``None`` on anything unusable.

    Never raises: empty/blank input, invalid JSON, and non-object JSON (a
    bare list/number/string) all fail open to ``None`` so callers can just
    check ``if payload is None: return <allow>``.
    """
    if not text or not text.strip():
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def session_id_of(payload: dict) -> str | None:
    value = payload.get("sessionId")
    return value if isinstance(value, str) and value else None


def workspace_root_of(payload: dict) -> str | None:
    """Prefer ``workspaceRoot``; fall back to ``cwd`` (both confirmed present
    on every event's stdin envelope)."""
    for key in ("workspaceRoot", "cwd"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def state_dir() -> Path:
    override = os.environ.get(STATE_DIR_ENV)
    base = Path(override) if override else Path(tempfile.gettempdir()) / "grokforge-hooks"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _session_key(session_id: str) -> str:
    return _SAFE_KEY_RE.sub("_", session_id)[:128] or "unknown"


def changed_marker_path(session_id: str, *, base: Path | None = None) -> Path:
    return (base or state_dir()) / f"changed-{_session_key(session_id)}.marker"


def block_counter_path(session_id: str, *, base: Path | None = None) -> Path:
    return (base or state_dir()) / f"blocks-{_session_key(session_id)}.count"


def mark_changed(session_id: str, *, base: Path | None = None) -> None:
    path = changed_marker_path(session_id, base=base)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("1", encoding="utf-8")


def has_changed(session_id: str, *, base: Path | None = None) -> bool:
    return changed_marker_path(session_id, base=base).is_file()


def clear_changed(session_id: str, *, base: Path | None = None) -> None:
    path = changed_marker_path(session_id, base=base)
    if path.is_file():
        path.unlink()


def read_block_count(session_id: str, *, base: Path | None = None) -> int:
    path = block_counter_path(session_id, base=base)
    if not path.is_file():
        return 0
    try:
        return int(path.read_text(encoding="utf-8").strip() or "0")
    except (OSError, ValueError):
        return 0


def write_block_count(session_id: str, count: int, *, base: Path | None = None) -> None:
    path = block_counter_path(session_id, base=base)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(count), encoding="utf-8")


def clear_block_count(session_id: str, *, base: Path | None = None) -> None:
    path = block_counter_path(session_id, base=base)
    if path.is_file():
        path.unlink()


def run_safely(shell_fn: Callable[[], int]) -> int:
    """Run a hook's thin I/O shell, never letting an unexpected exception
    propagate. A crashing hook must fail open (exit 0), not wedge the turn."""
    try:
        return shell_fn()
    except Exception as exc:  # deliberate catch-all: fail open, never wedge the turn
        print(f"hook error (ignored, fail-open): {exc}", file=sys.stderr)
        return 0
