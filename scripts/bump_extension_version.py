#!/usr/bin/env python3
"""Bump the extension Marketplace version in package.json (patch +1).

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


def bump_patch(version: str) -> str:
    major, minor, patch = parse_semver(version)
    return f"{major}.{minor}.{patch + 1}"


# Match "version": "X.Y.Z" only at the top-level package.json key (first occurrence).
_VERSION_RE = re.compile(
    r'^([ \t]*"version"[ \t]*:[ \t]*")([^"]+)(")',
    re.MULTILINE,
)


def bump_package_json_text(raw: str) -> tuple[str, str, str]:
    """Return (new_text, old_version, new_version). Raises ValueError if no version key."""
    m = _VERSION_RE.search(raw)
    if not m:
        raise ValueError('no "version" field found in package.json')
    old = m.group(2)
    new = bump_patch(old)
    new_text = raw[: m.start()] + m.group(1) + new + m.group(3) + raw[m.end() :]
    return new_text, old, new


def main() -> int:
    p = argparse.ArgumentParser(description="Bump package.json patch version for rebuilds.")
    p.add_argument("--root", type=Path, default=None, help="Repo root (default: parent of scripts/)")
    p.add_argument("--dry-run", action="store_true", help="Print new version without writing")
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
    print(new)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
