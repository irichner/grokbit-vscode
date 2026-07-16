#!/usr/bin/env python3
"""Install GrokForge git hooks (pre-commit metrics) into a repo.

Usage:
  python scripts/install_git_hooks.py
  python scripts/install_git_hooks.py --root C:\\path\\to\\project
  python scripts/install_git_hooks.py --root . --dry-run
"""

from __future__ import annotations

import argparse
import shutil
import stat
import subprocess
import sys
from pathlib import Path


def default_root() -> Path:
    return Path(__file__).resolve().parent.parent


def is_git_repo(path: Path) -> bool:
    try:
        r = subprocess.run(
            ["git", "-C", str(path), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        return r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def install_hooks(root: Path, *, dry_run: bool = False) -> int:
    root = root.resolve()
    if not is_git_repo(root):
        print(f"ERROR: not a git repo: {root}", file=sys.stderr)
        return 1

    src = root / "scripts" / "githooks" / "pre-commit"
    if not src.is_file():
        # When installing into another project, hooks may live under source template;
        # caller should copy scripts/ first. Try relative to this file.
        alt = Path(__file__).resolve().parent / "githooks" / "pre-commit"
        if alt.is_file():
            src = alt
        else:
            print(f"ERROR: hook source missing: {src}", file=sys.stderr)
            return 1

    hooks_dir = root / ".git" / "hooks"
    dest = hooks_dir / "pre-commit"
    print(f"Install pre-commit hook: {dest}")
    if dry_run:
        return 0

    hooks_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    # Ensure executable bit on Unix; on Windows git still runs with sh.
    mode = dest.stat().st_mode
    dest.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    # Ensure prepare script exists
    prep = root / "scripts" / "prepare_commit_metrics.py"
    if not prep.is_file():
        print(
            "WARNING: scripts/prepare_commit_metrics.py not in target; "
            "copy scripts/ from the template for the hook to work.",
            file=sys.stderr,
        )
    print("Done. Every commit will update VERSION + docs/metrics/token-ledger.md")
    print("Provide tokens via env, pending-commit.env, or --unmeasured (see docs/metrics/README.md)")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Install GrokForge commit metrics git hooks")
    p.add_argument("--root", type=Path, default=None, help="Git repo root")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)
    return install_hooks(args.root or default_root(), dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
