#!/usr/bin/env python3
"""Stop hook: the completion gate. Run the real Lint + Unit tests commands from
`AGENTS.md` Project Test Commands before the agent is allowed to finish, and
block with a precise reason when they fail.

Scope (OQ2, `docs/plans/grok-harness-improvements.md` §8): this gate runs
**Lint + Unit tests only** — not Coverage, not diff-cover, not the Regression /
full-suite row. It is a fast backstop, not a replacement for `/implement`'s
accuracy protocol.

Loop safety: a bounded per-session counter (`MAX_BLOCKS`, default 3) guarantees
the gate releases control back to the operator with an explicit "not done"
message rather than blocking forever on an unpassable check. This is on top of
(not instead of) the platform's own built-in 8-continuation cap per turn.

Contract (confirmed against the installed CLI's own docs and a live probe, see
`.grok/hooks/README.md`):
- Block the stop: print ``{"decision": "block", "reason": ...}`` to stdout
  (honored regardless of exit code); we also exit 2 and repeat the reason on
  stderr as a fallback for the exit-code path.
- Allow the stop: exit 0. Non-JSON stdout also still allows, so the
  gate-released message is printed as plain text, not JSON.
- An extra observe-only ``Stop`` fires at session end (``reason`` other than
  ``"end_turn"``, e.g. ``"channel_closed"``/``"shutdown"``); we skip the gate
  for those so the session-end fire never trips the block counter.

Fail-open: malformed/empty stdin, or a payload missing ``sessionId``, allows
the stop (exit 0) rather than blocking on incomplete information.
"""

from __future__ import annotations

import functools
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import _common as hc  # noqa: E402

BEGIN_PTC = "<!-- BEGIN PROJECT_TEST_COMMANDS -->"
END_PTC = "<!-- END PROJECT_TEST_COMMANDS -->"
GATE_LABELS: tuple[str, ...] = ("Lint", "Unit tests")
DEFAULT_MAX_BLOCKS = 3
TAIL_LINES = 40

# Keep comfortably under the wired Stop timeout (600s, see settings.json) so the
# CLI's own external kill never races our internal per-command timeout — see
# _command_timeout() below.
TOTAL_RUN_BUDGET_SECONDS = 550.0

_ROW_RE = re.compile(r"^-\s*\*\*([^:*]+):\*\*\s*(.+)$", re.MULTILINE)
_CMD_RE = re.compile(r"`([^`]+)`")
_PLACEHOLDER_RE = re.compile(r"^(TODO|NONE)\b", re.IGNORECASE)

Runner = Callable[[str, Path], "tuple[bool, str]"]


def extract_ptc_rows(agents_text: str) -> dict[str, str]:
    """Parse ``- **Label:** value`` rows from between the PROJECT_TEST_COMMANDS
    markers in `AGENTS.md`. Returns {} if the markers are missing."""
    if BEGIN_PTC not in agents_text or END_PTC not in agents_text:
        return {}
    block = agents_text.split(BEGIN_PTC, 1)[1].split(END_PTC, 1)[0]
    return {m.group(1).strip(): m.group(2).strip() for m in _ROW_RE.finditer(block)}


def _is_placeholder_command(cmd: str) -> bool:
    """True when an already backtick-extracted command is actually a
    Project Test Commands placeholder, not a real shell command.

    The installer's ``--no-scan`` path emits the row value verbatim as
    `` `TODO — user must fill` `` — backticks included — and a NONE-tooling
    row emits `` `NONE — no tool in repo` ``. Both parse as a non-empty
    backtick-wrapped "command" if only backtick-presence is checked, and
    would otherwise reach the shell runner as a bogus, permanently-failing
    command. Case-insensitive since AGENTS.md prose isn't case-normalized.
    """
    return not cmd or bool(_PLACEHOLDER_RE.match(cmd))


def extract_gate_commands(
    rows: dict[str, str], labels: tuple[str, ...] = GATE_LABELS
) -> list[tuple[str, str]]:
    """Pick the real, executable commands for *labels*.

    A row with no backtick-wrapped command, or whose extracted command is
    empty or a `TODO`/`NONE` placeholder (case-insensitive), is skipped —
    those values are never executed as a shell string. A row may legitimately
    contain more than one backtick-quoted command (the installer joins a
    monorepo Lint row with " · ", e.g. `` `ruff check .` · `cd frontend && npm
    run lint` ``) — every real command in the row runs, not just the first.
    """
    commands: list[tuple[str, str]] = []
    for label in labels:
        value = rows.get(label, "")
        for raw_cmd in _CMD_RE.findall(value):
            cmd = raw_cmd.strip()
            if _is_placeholder_command(cmd):
                continue
            commands.append((label, cmd))
    return commands


@dataclass
class CommandResult:
    label: str
    command: str
    passed: bool
    output: str


def _command_timeout(num_commands: int) -> float:
    """Split the total run budget across *num_commands* sequential commands.

    The Stop hook is wired with a single 600s external timeout
    (`.grok/hooks/settings.json`), but the gate can run more than one command
    (Lint + Unit tests, and a monorepo row can hold several `·`-joined
    commands). Without a shared, shrinking-per-command budget, N sequential
    per-command timeouts near the wired ceiling let the CLI's own external
    kill race the last command — and a timeout is fail-open, so the gate
    would silently pass exactly when the suite is slowest. One command still
    gets the full budget.
    """
    if num_commands <= 0:
        return TOTAL_RUN_BUDGET_SECONDS
    return TOTAL_RUN_BUDGET_SECONDS / num_commands


def _default_runner(cmd: str, cwd: Path, *, timeout: float = TOTAL_RUN_BUDGET_SECONDS) -> tuple[bool, str]:
    try:
        proc = subprocess.run(
            cmd,
            shell=True,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"error running command: {exc}"
    return proc.returncode == 0, (proc.stdout or "") + (proc.stderr or "")


def run_gate_commands(
    commands: list[tuple[str, str]], cwd: Path, runner: Runner | None = None
) -> list[CommandResult]:
    if runner is not None:
        run: Runner = runner
    else:
        run = functools.partial(_default_runner, timeout=_command_timeout(len(commands)))
    results = []
    for label, cmd in commands:
        ok, output = run(cmd, cwd)
        results.append(CommandResult(label=label, command=cmd, passed=ok, output=output))
    return results


def _tail(text: str, n: int = TAIL_LINES) -> str:
    return "\n".join(text.splitlines()[-n:])


def build_block_reason(results: list[CommandResult]) -> str:
    parts = [
        "The completion gate is blocking: required checks are failing. "
        "Fix the root cause -- do not weaken or skip the checks -- then finish.",
        "",
    ]
    for r in results:
        if r.passed:
            continue
        parts.append(f"### {r.label} FAILED (`{r.command}`)")
        parts.append(_tail(r.output))
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def release_message(max_blocks: int) -> str:
    return (
        f"verify_on_stop.py: checks still failing after {max_blocks} attempt(s). "
        "Releasing the gate so you can intervene. This work is NOT done."
    )


NO_COMMANDS_NOTE = (
    "verify_on_stop.py: files changed this session but zero Lint/Unit tests "
    "commands were found to run (TODO/NONE rows in AGENTS.md, or the "
    "PROJECT_TEST_COMMANDS markers are missing) -- nothing was verified this "
    "turn. This is allowed to proceed (a fresh, unfilled install is a "
    "legitimate state) but is never silent, so a neutered gate always leaves "
    "a trace."
)


@dataclass
class StopDecision:
    action: str  # "allow" | "block" | "release"
    exit_code: int
    stdout_text: str | None
    stderr_text: str | None
    counter_action: str  # "leave" | "clear" | "increment"
    clear_changed: bool
    new_count: int = 0


def decide_stop(
    *,
    changed: bool,
    results: list[CommandResult] | None,
    current_count: int,
    max_blocks: int = DEFAULT_MAX_BLOCKS,
) -> StopDecision:
    if not changed:
        return StopDecision(
            action="allow",
            exit_code=0,
            stdout_text=None,
            stderr_text=None,
            counter_action="leave",
            clear_changed=False,
        )
    if not results:
        # changed=True but zero gate commands were found. Never block on this
        # (TODO/NONE rows are a legitimate, common state) -- but never let it
        # be silent either: a gate that lost its commands (markers deleted,
        # rows flipped to NONE) must leave a trace, not a quiet allow.
        return StopDecision(
            action="allow",
            exit_code=0,
            stdout_text=None,
            stderr_text=NO_COMMANDS_NOTE,
            counter_action="clear",
            clear_changed=True,
        )
    if all(r.passed for r in results):
        return StopDecision(
            action="allow",
            exit_code=0,
            stdout_text=None,
            stderr_text=None,
            counter_action="clear",
            clear_changed=True,
        )
    count = current_count + 1
    if count >= max_blocks:
        return StopDecision(
            action="release",
            exit_code=0,
            stdout_text=release_message(max_blocks),
            stderr_text=None,
            counter_action="clear",
            clear_changed=False,
        )
    reason = build_block_reason(results)
    return StopDecision(
        action="block",
        exit_code=2,
        stdout_text=json.dumps({"decision": "block", "reason": reason}),
        stderr_text=reason,
        counter_action="increment",
        clear_changed=False,
        new_count=count,
    )


def main(
    stdin_text: str,
    *,
    cwd: Path | None = None,
    state_base: Path | None = None,
    runner: Runner | None = None,
    max_blocks: int = DEFAULT_MAX_BLOCKS,
) -> tuple[int, str | None, str | None]:
    payload = hc.parse_event(stdin_text)
    if payload is None:
        return 0, None, None

    reason_field = payload.get("reason")
    if reason_field is not None and reason_field != "end_turn":
        # Observe-only Stop fired at session end/interrupt; never gate on it.
        return 0, None, None

    session_id = hc.session_id_of(payload)
    if not session_id:
        return 0, None, None

    root = Path(cwd) if cwd is not None else Path(hc.workspace_root_of(payload) or ".")
    changed = hc.has_changed(session_id, base=state_base)

    results: list[CommandResult] | None = None
    if changed:
        agents_path = root / "AGENTS.md"
        agents_text = ""
        if agents_path.is_file():
            try:
                agents_text = agents_path.read_text(encoding="utf-8")
            except OSError:
                agents_text = ""
        rows = extract_ptc_rows(agents_text)
        commands = extract_gate_commands(rows)
        results = run_gate_commands(commands, root, runner) if commands else []

    current_count = hc.read_block_count(session_id, base=state_base)
    decision = decide_stop(
        changed=changed, results=results, current_count=current_count, max_blocks=max_blocks
    )

    if decision.counter_action == "clear":
        hc.clear_block_count(session_id, base=state_base)
    elif decision.counter_action == "increment":
        hc.write_block_count(session_id, decision.new_count, base=state_base)
    if decision.clear_changed:
        hc.clear_changed(session_id, base=state_base)

    return decision.exit_code, decision.stdout_text, decision.stderr_text


def _run() -> int:
    text = sys.stdin.read()
    max_blocks = int(os.environ.get("GROK_HOOKS_MAX_BLOCKS", DEFAULT_MAX_BLOCKS))
    code, out, err = main(text, max_blocks=max_blocks)
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(hc.run_safely(_run))
