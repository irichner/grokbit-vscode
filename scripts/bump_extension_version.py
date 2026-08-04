#!/usr/bin/env python3
"""Bump the extension Marketplace version in package.json (CalVer).

Scheme: **YYYY.M.N** (calendar versioning, semver-compatible for vsce):
  - YYYY — calendar year (major)
  - M    — calendar month 1–12 (minor; no leading zero — semver forbids them)
  - N    — rebuild sequence within that month (patch), starting at 1

Each rebuild either increments N for the current year/month, or resets to
`YYYY.M.1` when the calendar month rolls (or when migrating from legacy
semver like `3.0.20`).

This is the **product** version (`package.json` → Marketplace / vsix name).
It is independent of the agentic-template `VERSION` file (commit metrics).

Used by install scripts so every rebuild produces a new versioned build.
Agents may also run it before `npm run package` when the user asks to rebuild.

Usage (from repo root):
  python scripts/bump_extension_version.py
  python scripts/bump_extension_version.py --dry-run
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path


def default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_semver(version: str) -> tuple[int, int, int]:
    parts = version.strip().split(".")
    nums: list[int] = []
    for p in parts[:3]:
        m = re.match(r"(\d+)", p)
        nums.append(int(m.group(1)) if m else 0)
    while len(nums) < 3:
        nums.append(0)
    return nums[0], nums[1], nums[2]


def format_calver(year: int, month: int, seq: int) -> str:
    if not (1 <= month <= 12):
        raise ValueError(f"month must be 1–12, got {month}")
    if seq < 1:
        raise ValueError(f"sequence must be >= 1, got {seq}")
    # No zero-padding: node-semver / vsce reject leading zeros.
    return f"{year}.{month}.{seq}"


def bump_calver(version: str, today: date | None = None) -> str:
    """Next CalVer for *today*, incrementing the in-month sequence when already on it."""
    d = today or date.today()
    year, month = d.year, d.month
    major, minor, patch = parse_semver(version)
    if major == year and minor == month and patch >= 1:
        return format_calver(year, month, patch + 1)
    return format_calver(year, month, 1)


# Match "version": "X.Y.Z" only at the top-level package.json key (first occurrence).
_VERSION_RE = re.compile(
    r'^([ \t]*"version"[ \t]*:[ \t]*")([^"]+)(")',
    re.MULTILINE,
)


def bump_package_json_text(
    raw: str, today: date | None = None
) -> tuple[str, str, str]:
    """Return (new_text, old_version, new_version). Raises ValueError if no version key."""
    m = _VERSION_RE.search(raw)
    if not m:
        raise ValueError('no "version" field found in package.json')
    old = m.group(2)
    new = bump_calver(old, today=today)
    new_text = raw[: m.start()] + m.group(1) + new + m.group(3) + raw[m.end() :]
    return new_text, old, new


# Keep a Changelog heading for the open work bucket (with or without brackets).
_UNRELEASED_HEADING = re.compile(
    r"^##\s+\[?Unreleased\]?\s*$",
    re.IGNORECASE | re.MULTILINE,
)
# Next ## version heading after Unreleased (stops the unreleased body).
_NEXT_VERSION_HEADING = re.compile(r"^##\s+", re.MULTILINE)


def cut_unreleased_changelog(
    raw: str, version: str, today: date | None = None
) -> tuple[str, bool]:
    """Promote a non-empty ``## Unreleased`` body to ``## {version} — {date}``.

    Leaves an empty ``## Unreleased`` bucket on top for the next cycle.
    Returns ``(new_text, changed)``. No-op when Unreleased is missing or empty,
    or when a ``## {version}`` section already exists.
    """
    d = today or date.today()
    m = _UNRELEASED_HEADING.search(raw)
    if not m:
        return raw, False

    # Already cut for this version (e.g. re-run / manual section).
    if re.search(
        rf"^##\s+\[?{re.escape(version)}\]?(?:\s|[—–-]|$)",
        raw,
        re.MULTILINE,
    ):
        return raw, False

    body_start = m.end()
    # Skip a single trailing newline after the heading so body is pure content.
    if body_start < len(raw) and raw[body_start] == "\n":
        body_start += 1
    next_h = _NEXT_VERSION_HEADING.search(raw, body_start)
    body_end = next_h.start() if next_h else len(raw)
    body = raw[body_start:body_end]
    # Content = any bullet or ### subsection (not just whitespace).
    if not re.search(r"(?m)^(?:### |\- |\* )", body):
        return raw, False

    date_str = d.isoformat()  # YYYY-MM-DD
    # Normalize body trailing newlines to exactly two before the next section.
    body_norm = body.rstrip("\n") + "\n\n"
    replacement = (
        f"## Unreleased\n\n"
        f"## {version} — {date_str}\n\n"
        f"{body_norm}"
    )
    # Drop the old Unreleased heading + body; keep everything from the next ##.
    new_raw = raw[: m.start()] + replacement + raw[body_end:]
    return new_raw, True


def main() -> int:
    p = argparse.ArgumentParser(
        description="Bump package.json to the next CalVer (YYYY.M.N) for rebuilds."
    )
    p.add_argument("--root", type=Path, default=None, help="Repo root (default: parent of scripts/)")
    p.add_argument("--dry-run", action="store_true", help="Print new version without writing")
    p.add_argument(
        "--no-changelog",
        action="store_true",
        help="Do not cut CHANGELOG.md Unreleased → new version",
    )
    args = p.parse_args()
    root = (args.root or default_root()).resolve()
    pkg_path = root / "package.json"
    if not pkg_path.is_file():
        print(f"error: package.json not found at {pkg_path}", file=sys.stderr)
        return 1

    raw = pkg_path.read_text(encoding="utf-8")
    try:
        new_text, old, new = bump_package_json_text(raw)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(new)
        return 0

    # Preserve original newline style of the file.
    pkg_path.write_text(new_text, encoding="utf-8", newline="")
    print(f"bumped package.json version: {old} → {new}", file=sys.stderr)

    if not args.no_changelog:
        cl_path = root / "CHANGELOG.md"
        if cl_path.is_file():
            cl_raw = cl_path.read_text(encoding="utf-8")
            cl_new, cl_changed = cut_unreleased_changelog(cl_raw, new)
            if cl_changed:
                cl_path.write_text(cl_new, encoding="utf-8", newline="")
                print(
                    f"cut CHANGELOG.md: Unreleased → {new} — {date.today().isoformat()}",
                    file=sys.stderr,
                )
            else:
                print(
                    "CHANGELOG.md: Unreleased empty or section already present — left as-is",
                    file=sys.stderr,
                )

    print(new)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
