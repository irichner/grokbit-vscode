#!/usr/bin/env python3
"""Append a token/model usage entry to docs/metrics/token-ledger.md and recompute totals.

Stdlib only. Does not invent figures — caller must supply measured values
(or explicitly mark unmeasured).

Usage (from repo root):
  python scripts/record_token_usage.py --model grok-build --input 12000 --output 4000 --note "..."
  python scripts/record_token_usage.py --unmeasured --note "tokens not available"
  python scripts/record_token_usage.py --model grok-build --input 1000 --output 200 --dry-run

For every git commit, prefer:
  python scripts/prepare_commit_metrics.py ...
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

LEDGER_REL = Path("docs/metrics/token-ledger.md")
LEDGER_END = "<!-- LEDGER_END -->"
VERSION_FILE = Path("VERSION")
UNMEASURED_MODEL = "unmeasured"


@dataclass
class Entry:
    date: str
    session: str
    model: str
    input_tokens: int
    output_tokens: int
    notes: str

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def is_measured(self) -> bool:
        return self.model.strip().lower() != UNMEASURED_MODEL and "[unmeasured]" not in (
            self.notes or ""
        ).lower()


def default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def read_template_version(root: Path) -> str:
    vf = root / VERSION_FILE
    if vf.is_file():
        return vf.read_text(encoding="utf-8").strip() or "unknown"
    return "unknown"


def write_template_version(root: Path, version: str) -> None:
    path = root / VERSION_FILE
    path.write_text(version.strip() + "\n", encoding="utf-8", newline="\n")


def parse_version(version: str) -> tuple[int, ...]:
    parts = []
    for p in version.strip().split("."):
        if p.isdigit():
            parts.append(int(p))
        else:
            m = re.match(r"(\d+)", p)
            parts.append(int(m.group(1)) if m else 0)
    if not parts:
        return (0, 0, 0)
    if len(parts) == 1:
        return (parts[0], 0, 0)
    if len(parts) == 2:
        return (parts[0], parts[1], 0)
    return tuple(parts[:3])


def format_version(parts: tuple[int, ...]) -> str:
    if len(parts) >= 3:
        return f"{parts[0]}.{parts[1]}.{parts[2]}"
    if len(parts) == 2:
        return f"{parts[0]}.{parts[1]}.0"
    return f"{parts[0]}.0.0"


def bump_patch(version: str) -> str:
    major, minor, patch = parse_version(version)
    return format_version((major, minor, patch + 1))


def parse_entries(text: str) -> list[Entry]:
    entries: list[Entry] = []
    in_entries = False
    for line in text.splitlines():
        if line.strip().startswith("## Entries"):
            in_entries = True
            continue
        if in_entries and line.strip().startswith("## "):
            break
        if in_entries and line.strip().startswith("|") and "----" not in line:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 6:
                continue
            if cells[0].lower().startswith("date") or cells[0].startswith("*("):
                continue
            try:
                inp = int(cells[3].replace(",", "") or "0")
                out = int(cells[4].replace(",", "") or "0")
            except ValueError:
                continue
            entries.append(
                Entry(
                    date=cells[0],
                    session=cells[1],
                    model=cells[2],
                    input_tokens=inp,
                    output_tokens=out,
                    notes=cells[6] if len(cells) > 6 else "",
                )
            )
    return entries


def measured_entries(entries: list[Entry]) -> list[Entry]:
    return [e for e in entries if e.is_measured]


def render_ledger(version: str, entries: list[Entry], last_updated: str) -> str:
    measured = measured_entries(entries)
    total_in = sum(e.input_tokens for e in measured)
    total_out = sum(e.output_tokens for e in measured)
    total = total_in + total_out
    unmeasured_n = len(entries) - len(measured)

    by_model: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    for e in measured:
        by_model[e.model][0] += e.input_tokens
        by_model[e.model][1] += e.output_tokens
        by_model[e.model][2] += 1

    lines = [
        "# Token & model usage ledger",
        "",
        f"**Template version:** {version}  ",
        f"**Last updated:** {last_updated}  ",
        "**Policy:** update **VERSION** + this ledger on **every git commit** "
        "(`scripts/prepare_commit_metrics.py` / pre-commit hook).  ",
        "**Source of figures:** session stats (`/context`, `/session-info`, host UI) — never invent.",
        "",
        "## Running totals",
        "",
        "| Metric | Value |",
        "|--------|------:|",
        f"| Total input tokens (measured) | {total_in} |",
        f"| Total output tokens (measured) | {total_out} |",
        f"| Total tokens (measured) | {total} |",
        f"| Measured entries | {len(measured)} |",
        f"| Unmeasured commit stamps | {unmeasured_n} |",
        f"| All ledger entries | {len(entries)} |",
        "",
        "## By model (measured only)",
        "",
        "| Model | Input | Output | Total | Entries |",
        "|-------|------:|-------:|------:|--------:|",
    ]
    if by_model:
        for model in sorted(by_model.keys()):
            inp, out, n = by_model[model]
            lines.append(f"| {model} | {inp} | {out} | {inp + out} | {n} |")
    else:
        lines.append("| *(none yet)* | 0 | 0 | 0 | 0 |")

    lines.extend(
        [
            "",
            "## Entries",
            "",
            "| Date (UTC) | Session / label | Model | Input | Output | Total | Notes |",
            "|------------|-----------------|-------|------:|-------:|------:|-------|",
        ]
    )
    if entries:
        for e in entries:
            notes = e.notes.replace("|", "\\|")
            session = e.session.replace("|", "\\|")
            lines.append(
                f"| {e.date} | {session} | {e.model} | {e.input_tokens} | "
                f"{e.output_tokens} | {e.total} | {notes} |"
            )
    else:
        lines.append("| *(none yet)* | | | | | | |")

    lines.extend(
        [
            "",
            LEDGER_END,
            "",
            "## Notes",
            "",
            "- **Every commit** must refresh VERSION (patch bump) and append a ledger row "
            "via `prepare_commit_metrics.py` (enforced by git pre-commit when hooks installed).",
            "- Model `unmeasured` / notes containing `[unmeasured]` do **not** add to token totals.",
            "- Subagent usage: when the host only reports parent-session totals, note that limitation.",
            "- Entries are append-only; corrections use a follow-up entry (negative only if host confirms).",
            "- Keep this file in version control so the team shares one running total.",
            "",
        ]
    )
    return "\n".join(lines)


def ensure_ledger(path: Path, version: str) -> str:
    if path.is_file():
        return path.read_text(encoding="utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    text = render_ledger(version, [], datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    path.write_text(text, encoding="utf-8", newline="\n")
    return text


def append_entry(
    root: Path,
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    note: str = "",
    session: str = "",
    date: str | None = None,
    version: str | None = None,
    dry_run: bool = False,
) -> tuple[str, Entry, list[Entry]]:
    """Append one entry; returns (ledger_text, new_entry, all_entries)."""
    if input_tokens < 0 or output_tokens < 0:
        raise ValueError("token counts must be >= 0")
    ver = version or read_template_version(root)
    ledger_path = root / LEDGER_REL
    text = ensure_ledger(ledger_path, ver)
    entries = parse_entries(text)
    day = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("date must be YYYY-MM-DD")
    sess = session.strip() or f"session-{day}"
    entry = Entry(
        date=day,
        session=sess,
        model=model.strip(),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        notes=note.strip(),
    )
    entries.append(entry)
    new_text = render_ledger(ver, entries, day)
    if not dry_run:
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        ledger_path.write_text(new_text, encoding="utf-8", newline="\n")
    return new_text, entry, entries


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Record token/model usage in the project ledger.")
    p.add_argument("--root", type=Path, default=None, help="Project root (default: parent of scripts/)")
    p.add_argument("--model", default=None, help="Model id (e.g. grok-build)")
    p.add_argument("--input", type=int, default=None, dest="input_tokens", help="Input tokens (>= 0)")
    p.add_argument("--output", type=int, default=None, dest="output_tokens", help="Output tokens (>= 0)")
    p.add_argument(
        "--unmeasured",
        action="store_true",
        help="Record a stamp without measured tokens (excluded from totals)",
    )
    p.add_argument("--note", default="", help="Short note for the entry")
    p.add_argument("--session", default="", help="Session id or short label")
    p.add_argument("--date", default=None, help="UTC date YYYY-MM-DD (default: today UTC)")
    p.add_argument("--dry-run", action="store_true", help="Print new ledger to stdout; do not write")
    args = p.parse_args(argv)

    root = (args.root or default_root()).resolve()

    if args.unmeasured:
        model = UNMEASURED_MODEL
        inp, out = 0, 0
        note = args.note.strip()
        if "[unmeasured]" not in note.lower():
            note = (note + " [unmeasured]").strip()
    else:
        if args.model is None or args.input_tokens is None or args.output_tokens is None:
            print(
                "ERROR: provide --model --input --output, or --unmeasured",
                file=sys.stderr,
            )
            return 2
        model = args.model
        inp, out = args.input_tokens, args.output_tokens
        note = args.note

    try:
        new_text, entry, entries = append_entry(
            root,
            model=model,
            input_tokens=inp,
            output_tokens=out,
            note=note,
            session=args.session,
            date=args.date,
            dry_run=args.dry_run,
        )
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(new_text)
        return 0

    measured = measured_entries(entries)
    print(
        f"Recorded: model={entry.model} input={entry.input_tokens} output={entry.output_tokens} "
        f"total={entry.total} → {LEDGER_REL.as_posix()}"
    )
    print(
        f"Running measured total tokens: {sum(x.total for x in measured)} "
        f"({len(measured)} measured / {len(entries)} entries)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
