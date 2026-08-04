#!/usr/bin/env python3
"""SessionStart hook: reset this session's Stop-gate state; print a repo snapshot.

Confirmed contract (see `.grok/hooks/README.md`): `SessionStart` is a
**passive** hook — its stdout is *not* injected into the model's context (only
`Stop`/`SubagentStop` support a feedback channel). The snapshot below is
printed for human/`/hooks` visibility only; its functional effect is
resetting the per-session change-marker and Stop-gate retry counter (see
`mark_changed.py` / `verify_on_stop.py`) so a fresh or resumed session starts
with a clean gate.

Fail-open: any error (no git repo, git not on PATH, malformed stdin) still
exits 0 and never blocks the session from starting.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import _common as hc  # noqa: E402


def _git(args: list[str], cwd: Path) -> str:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return proc.stdout if proc.returncode == 0 else ""


def format_snapshot(branch: str, dirty_files: list[str], recent_commits: list[str]) -> str:
    lines = ["## Repository snapshot", f"- Branch: {branch or '?'}"]
    if not dirty_files:
        lines.append("- Working tree: clean")
    else:
        lines.append(f"- Working tree: {len(dirty_files)} uncommitted change(s)")
        lines.append("- Changed files:")
        lines.extend(f"    {f}" for f in dirty_files[:20])
    lines.append("- Recent commits:")
    lines.extend(f"    {c}" for c in recent_commits[:5])
    return "\n".join(lines)


def build_git_snapshot(cwd: Path) -> str | None:
    """Return a formatted snapshot, or ``None`` when *cwd* is not a git repo."""
    if not (cwd / ".git").exists():
        return None
    branch = _git(["branch", "--show-current"], cwd).strip()
    status = _git(["status", "--porcelain"], cwd)
    dirty_files = [line for line in status.splitlines() if line.strip()]
    log = _git(["log", "--oneline", "-5"], cwd)
    recent_commits = [line for line in log.splitlines() if line.strip()]
    return format_snapshot(branch, dirty_files, recent_commits)


def main(stdin_text: str, *, cwd: Path | None = None, state_base: Path | None = None) -> str:
    """Reset gate state for this session; return the snapshot text (or "")."""
    payload = hc.parse_event(stdin_text) or {}
    session_id = hc.session_id_of(payload)
    if session_id:
        hc.clear_changed(session_id, base=state_base)
        hc.clear_block_count(session_id, base=state_base)
    root = Path(cwd) if cwd is not None else Path(hc.workspace_root_of(payload) or ".")
    snapshot = build_git_snapshot(root)
    return snapshot or ""


def _run() -> int:
    text = sys.stdin.read()
    snapshot = main(text)
    if snapshot:
        print(snapshot)
    return 0


if __name__ == "__main__":
    sys.exit(hc.run_safely(_run))
