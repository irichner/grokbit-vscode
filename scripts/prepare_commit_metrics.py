#!/usr/bin/env python3
"""Update VERSION + token ledger for every git commit.

Mandatory before each commit (also run by scripts/githooks/pre-commit).

Measured tokens (preferred):
  python scripts/prepare_commit_metrics.py --model grok-build --input 12000 --output 4000 --note "..."

Env vars (used by the git hook / --from-env):
  GROK_MODEL, GROK_INPUT_TOKENS, GROK_OUTPUT_TOKENS, GROK_METRICS_NOTE
  GROK_TOKENS_UNMEASURED=1   # explicit unmeasured stamp (not invented numbers)

Pending file (agent-friendly): docs/metrics/pending-commit.env
  MODEL=grok-build
  INPUT=12000
  OUTPUT=4000
  NOTE=session work
  UNMEASURED=0

By default bumps the patch segment of VERSION (1.7.0 -> 1.7.1).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Load sibling module without requiring package install
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

import record_token_usage as rtu  # noqa: E402

PENDING_REL = Path("docs/metrics/pending-commit.env")
STAMP_REL = Path("docs/metrics/.commit-metrics-stamp")


def _parse_pending(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip().upper()] = v.strip().strip('"').strip("'")
    return data


def _git_add(root: Path, paths: list[Path]) -> None:
    rels = [str(p.relative_to(root)).replace("\\", "/") for p in paths if p.exists()]
    if not rels:
        return
    subprocess.run(
        ["git", "-C", str(root), "add", "--", *rels],
        check=False,
        capture_output=True,
        text=True,
    )


def _clear_pending(path: Path) -> None:
    if path.is_file():
        path.unlink()


def resolve_metrics(args: argparse.Namespace, root: Path) -> tuple[str, int, int, str, bool]:
    """Return model, input, output, note, unmeasured."""
    pending = _parse_pending(root / PENDING_REL)

    unmeasured = bool(args.unmeasured)
    if args.from_env or not (args.model or args.unmeasured):
        if os.environ.get("GROK_TOKENS_UNMEASURED", "").strip() in {"1", "true", "yes"}:
            unmeasured = True
        if pending.get("UNMEASURED", "").lower() in {"1", "true", "yes"}:
            unmeasured = True

    note = args.note or os.environ.get("GROK_METRICS_NOTE", "") or pending.get("NOTE", "")
    model = args.model or os.environ.get("GROK_MODEL", "") or pending.get("MODEL", "")

    def _int(name_cli: int | None, env_key: str, pending_key: str) -> int | None:
        if name_cli is not None:
            return name_cli
        raw = os.environ.get(env_key, "") or pending.get(pending_key, "")
        if raw == "":
            return None
        return int(raw)

    inp = _int(args.input_tokens, "GROK_INPUT_TOKENS", "INPUT")
    out = _int(args.output_tokens, "GROK_OUTPUT_TOKENS", "OUTPUT")

    if unmeasured:
        return rtu.UNMEASURED_MODEL, 0, 0, note, True

    if model and inp is not None and out is not None:
        return model, inp, out, note, False

    # GUI commits (VS Code/Cursor Source Control) rarely pass env vars. Still satisfy
    # the every-commit policy with an honest unmeasured stamp rather than blocking.
    # Measured tokens remain preferred when provided; never invent numbers.
    if args.from_env or args.allow_unmeasured_fallback:
        warn = (
            "WARNING: no measured tokens provided; recording unmeasured stamp "
            "(VERSION still patch-bumps). To record real usage next time, set "
            "GROK_MODEL/GROK_INPUT_TOKENS/GROK_OUTPUT_TOKENS, write "
            "docs/metrics/pending-commit.env, or run prepare_commit_metrics "
            "with --model/--input/--output before commit."
        )
        print(warn, file=sys.stderr)
        fallback_note = note or "auto unmeasured (no metrics in env/pending file)"
        return rtu.UNMEASURED_MODEL, 0, 0, fallback_note, True

    raise SystemExit(
        "ERROR: commit metrics required.\n"
        "  Measured:  python scripts/prepare_commit_metrics.py --model <id> --input N --output M\n"
        "  Or env:    GROK_MODEL, GROK_INPUT_TOKENS, GROK_OUTPUT_TOKENS\n"
        "  Or file:   docs/metrics/pending-commit.env\n"
        "  Unknown:   python scripts/prepare_commit_metrics.py --unmeasured --note '...'\n"
        "Never invent token counts."
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Update VERSION + token ledger for a git commit.")
    p.add_argument("--root", type=Path, default=None)
    p.add_argument("--model", default=None)
    p.add_argument("--input", type=int, default=None, dest="input_tokens")
    p.add_argument("--output", type=int, default=None, dest="output_tokens")
    p.add_argument("--unmeasured", action="store_true")
    p.add_argument("--note", default="")
    p.add_argument(
        "--from-env",
        action="store_true",
        help="Read GROK_* env and/or docs/metrics/pending-commit.env; "
        "if none, fall back to unmeasured (for GUI commits)",
    )
    p.add_argument(
        "--allow-unmeasured-fallback",
        action="store_true",
        help="If measured metrics missing, record unmeasured instead of failing",
    )
    p.add_argument(
        "--no-bump",
        action="store_true",
        help="Do not bump VERSION patch (still sync ledger header)",
    )
    p.add_argument(
        "--stage",
        action="store_true",
        help="git add VERSION + ledger after update (used by pre-commit)",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--session", default="")
    args = p.parse_args(argv)

    root = (args.root or rtu.default_root()).resolve()
    if not (root / "VERSION").is_file() and not args.dry_run:
        # Create VERSION if missing so commits can proceed after bootstrap
        rtu.write_template_version(root, "0.1.0")

    model, inp, out, note, unmeasured = resolve_metrics(args, root)

    old_ver = rtu.read_template_version(root)
    if old_ver == "unknown":
        old_ver = "0.1.0"
    new_ver = old_ver if args.no_bump else rtu.bump_patch(old_ver)

    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    session = args.session.strip() or f"commit-{day}"
    if unmeasured:
        note = (note + " [unmeasured]").strip() if "[unmeasured]" not in note.lower() else note
        note = f"commit metrics v{new_ver}: {note}".strip(": ")
    else:
        note = f"commit metrics v{new_ver}: {note}".strip(": ")

    if args.dry_run:
        print(f"Would set VERSION {old_ver} -> {new_ver}")
        print(f"Would record model={model} input={inp} output={out} note={note!r}")
        return 0

    rtu.write_template_version(root, new_ver)
    _text, entry, entries = rtu.append_entry(
        root,
        model=model,
        input_tokens=inp,
        output_tokens=out,
        note=note,
        session=session,
        date=day,
        version=new_ver,
        dry_run=False,
    )

    stamp = root / STAMP_REL
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text(
        f"version={new_ver}\n"
        f"date={day}\n"
        f"model={entry.model}\n"
        f"input={entry.input_tokens}\n"
        f"output={entry.output_tokens}\n"
        f"total={entry.total}\n"
        f"unmeasured={1 if unmeasured else 0}\n",
        encoding="utf-8",
        newline="\n",
    )

    _clear_pending(root / PENDING_REL)

    if args.stage:
        _git_add(
            root,
            [
                root / rtu.VERSION_FILE,
                root / rtu.LEDGER_REL,
                stamp,
            ],
        )

    measured = rtu.measured_entries(entries)
    print(f"VERSION: {old_ver} -> {new_ver}")
    print(
        f"Ledger: model={entry.model} input={entry.input_tokens} "
        f"output={entry.output_tokens} total={entry.total}"
    )
    print(
        f"Measured project total tokens: {sum(e.total for e in measured)} "
        f"({len(measured)} measured entries)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
