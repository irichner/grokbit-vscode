#!/usr/bin/env python3
"""
check_drift.py — flag documentation whose sources have moved.

Reads `derived_from` frontmatter written by grokbit-document. Each entry is
`<path>@<commit>`, where `<commit>` is the commit the content was READ AT, not
the commit the document was written at — those differ whenever a doc is
generated from history. Drift is answered as a git question, not a string
comparison: "did `<path>` change between `<commit>` and HEAD?" via
`git diff --quiet <commit>..HEAD -- <path>`. Pure git + a minimal YAML subset:
no model call, because that question is deterministic and running it through
a model is slower, costlier and less reliable.

Flags CLAIMS, not documents. Stale-marking a forty-page guide because one
signature changed trains people to ignore the marker.

    python3 check_drift.py                 # scan docs/, README.md, CHANGELOG.md,
                                            # CONTRIBUTING.md, .grokbit/context/
    python3 check_drift.py --json          # machine-readable, for the extension
    python3 check_drift.py --ci            # exit 1 if anything was flagged
    python3 check_drift.py --path docs/api # narrow the scan to one path
    python3 check_drift.py --hook          # PostToolUse hook mode, see below

Findings are not all "drift" in the literal sense — a source with no commit
history, or a recorded commit that no longer resolves, is not the same claim
as "the source changed," so each is reported under its own `status` rather
than folded into one bucket:

    drifted         the source changed between the recorded commit and HEAD
    deleted         the source no longer exists
    untracked       the source exists but git has no history for it — the
                     recorded commit could not have been accurate
    unknown-commit  the recorded commit does not resolve in this repository
    no-provenance   the document has no derived_from at all (see hard rule 4)
    parse-error     the document's frontmatter could not be parsed

`--ci` exits 1 when any finding of any status exists — an unresolvable claim
is exactly as untrustworthy as a stale one.

HOOK MODE (--hook): intended to be wired as a Claude Code PostToolUse command
(see ../hooks/doc-drift.json for the settings.json snippet — Claude Code does
not auto-load a skill's own hooks/ directory, so that file is a manual
copy-in, not something this script loads itself). Reads the tool-call JSON
Claude Code passes on stdin, and skips silently — no scan, no output, exit 0
— when the edited path (`tool_input.file_path`/`tool_input.path`) sits inside
a noise directory (node_modules, .git, build output, venvs, ...). Otherwise
it runs the normal scan and prints findings only when there are any. Hook
mode always exits 0: it is advisory, exactly like the commit-time check
described in references/provenance.md. `--ci` is what enforces.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path

FRONTMATTER = "---"

DEFAULT_SCAN_PATHS = ("docs", "README.md", "CHANGELOG.md", "CONTRIBUTING.md", ".grokbit/context")

# Directories a hook invocation should never spend a git call on.
EXCLUDED_DIRS = {
    "node_modules", ".git", "dist", "build", "out", "vendor",
    ".venv", "venv", "__pycache__", "target", ".next", ".turbo",
}

FAIL_STATUSES = {"drifted", "deleted", "untracked", "unknown-commit", "no-provenance", "parse-error"}


@dataclass
class Finding:
    document: str
    source: str
    status: str
    recorded: str = ""
    current: str = ""
    sections: list[str] = field(default_factory=list)
    reason: str = ""


def force_utf8_stdio() -> None:
    """A restrictive Windows console codepage (cp1252, or the older OEM 437/850
    still seen on plain cmd.exe) cannot encode every character this module's
    own docstrings and messages use, and print() would then crash instead of
    reporting a finding. Force UTF-8 with lossy fallback rather than avoid
    non-ASCII prose altogether."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def git(*args: str, cwd: Path | None = None) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, OSError):
        # OSError also covers a `cwd` that doesn't exist or isn't a directory
        # (NotADirectoryError/FileNotFoundError on a bad --repo) and git not
        # being on PATH.
        return None


def git_diff_changed(recorded: str, path: str, repo: Path) -> bool | None:
    """True if `path` differs between `recorded` and HEAD, False if not,
    None if the comparison itself could not be run (caller treats that as
    unknown-commit, since the usual cause is a recorded sha that doesn't
    resolve here)."""
    try:
        r = subprocess.run(
            ["git", "diff", "--quiet", f"{recorded}..HEAD", "--", path],
            cwd=repo, capture_output=True, text=True,
        )
    except OSError:
        return None
    if r.returncode in (0, 1):
        return r.returncode == 1
    return None


def parse_frontmatter(text: str) -> dict:
    """Minimal YAML subset: scalars and '- ' lists. Avoids a PyYAML dependency
    so this can run in CI containers without an install step. Defensive on
    purpose — malformed frontmatter must degrade to {} for the offending
    key, never raise, so one bad file can't abort the whole scan."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != FRONTMATTER:
        return {}
    try:
        end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == FRONTMATTER)
    except StopIteration:
        return {}

    data: dict = {}
    key = None
    for raw in lines[1:end]:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.startswith(("  - ", "- ")):
            if not key:
                continue
            existing = data.get(key)
            if isinstance(existing, list):
                existing.append(raw.split("- ", 1)[1].strip())
            elif existing in (None, ""):
                data[key] = [raw.split("- ", 1)[1].strip()]
            else:
                # key was already a scalar (malformed: mixed scalar/list
                # under one key) — coerce rather than crash.
                data[key] = [existing, raw.split("- ", 1)[1].strip()]
            continue
        if ":" in raw:
            k, _, v = raw.partition(":")
            key = k.strip()
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                data[key] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
            elif v:
                data[key] = v
            else:
                data[key] = []
    return data


def as_list(value) -> list[str]:
    """`derived_from` is documented as a list but a single-source doc
    legitimately writes it as one scalar (`derived_from: src/a.ts@abc`).
    A bare string is iterable char-by-char in Python, so this normalization
    is mandatory before iterating."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [str(v) for v in value if str(v).strip()]


def sections_citing(doc_text: str, source: str) -> list[str]:
    """Which headings mention this source, skipping headings inside fenced
    code blocks (a `# comment` in an example script is not a heading). Lets
    the report name the stale paragraphs instead of condemning the whole
    file. Matching is by basename substring, which under-reports whenever a
    section cites a source without repeating its filename in prose — see
    references/provenance.md § Claim-level staleness."""
    stem = Path(source).name
    hits, heading, in_fence = [], "(top)", False
    for line in doc_text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence and line.startswith("#"):
            heading = line.lstrip("# ").strip()
        elif stem in line and heading not in hits:
            hits.append(heading)
    return hits


def check_source(doc: str, text: str, src: str, recorded: str, repo: Path) -> Finding | None:
    full = repo / src
    history = git("log", "-1", "--format=%h", "--", src, cwd=repo)

    if history is None:
        return Finding(doc, src, "unknown-commit", recorded, "", [],
                        "git could not read history for this source")
    if history == "":
        return Finding(doc, src, "untracked", recorded, "", sections_citing(text, src),
                        "source has no commit history — the recorded commit cannot be verified")
    if not full.exists():
        return Finding(doc, src, "deleted", recorded, "—", sections_citing(text, src),
                        "source deleted")

    if not recorded or git("rev-parse", "--quiet", "--verify", f"{recorded}^{{commit}}", cwd=repo) is None:
        return Finding(doc, src, "unknown-commit", recorded, "", sections_citing(text, src),
                        f"recorded commit {recorded!r} does not resolve in this repository")

    changed = git_diff_changed(recorded, src, repo)
    if changed is None:
        return Finding(doc, src, "unknown-commit", recorded, "", sections_citing(text, src),
                        f"could not diff {recorded!r}..HEAD for this source")
    if changed:
        current = git("rev-parse", "--short", "HEAD", cwd=repo) or "HEAD"
        return Finding(doc, src, "drifted", recorded, current, sections_citing(text, src),
                        "source changed")
    return None


def discover(repo: Path, roots: list[Path]) -> list[Path]:
    seen: set[Path] = set()
    docs: list[Path] = []
    for root in roots:
        if root.is_dir():
            for p in sorted(root.rglob("*.md")):
                if EXCLUDED_DIRS & set(p.parts):
                    continue
                if p not in seen:
                    seen.add(p)
                    docs.append(p)
        elif root.is_file() and root not in seen:
            seen.add(root)
            docs.append(root)
    return docs


def scan(repo: Path, roots: list[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for doc in discover(repo, roots):
        try:
            text = doc.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeDecodeError):
            continue
        try:
            fm = parse_frontmatter(text)
        except Exception:
            findings.append(Finding(str(doc), "", "parse-error",
                                    reason="frontmatter could not be parsed"))
            continue

        entries = as_list(fm.get("derived_from"))
        if not entries:
            findings.append(Finding(str(doc), "", "no-provenance",
                                    reason="no derived_from frontmatter — invisible to drift detection"))
            continue

        for entry in entries:
            src, _, recorded = entry.partition("@")
            src, recorded = src.strip(), recorded.strip()
            if not src:
                continue
            try:
                finding = check_source(str(doc), text, src, recorded, repo)
            except Exception:
                findings.append(Finding(str(doc), src, "parse-error", recorded,
                                        reason="check raised unexpectedly"))
                continue
            if finding is not None:
                findings.append(finding)
    return findings


def print_report(findings: list[Finding]) -> None:
    if not findings:
        print("No drift. Every documented source resolves and is unchanged since it was cited.")
        return
    print(f"{len(findings)} finding(s):\n")
    for f in findings:
        print(f"  {f.document}")
        label = {
            "drifted": "drifted", "deleted": "source deleted",
            "untracked": "untracked source", "unknown-commit": "unknown recorded commit",
            "no-provenance": "no provenance", "parse-error": "parse error",
        }.get(f.status, f.status)
        if f.source:
            print(f"    [{label}] source: {f.source}  {f.recorded or '(none)'} -> {f.current or '?'}  ({f.reason})")
        else:
            print(f"    [{label}] {f.reason}")
        if f.sections:
            print(f"    sections: {', '.join(f.sections)}")
        print()
    print("Regenerate with grokbit-document, or re-verify and bump the commit.")


def run_hook(repo: Path) -> int:
    """PostToolUse hook body — see the module docstring. Always returns 0."""
    try:
        payload = json.load(sys.stdin) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, ValueError):
        payload = {}
    tool_input = payload.get("tool_input") or {}
    edited = tool_input.get("file_path") or tool_input.get("path") or ""
    if edited:
        parts = set(Path(edited).parts)
        if EXCLUDED_DIRS & parts:
            return 0

    roots = [repo / p for p in DEFAULT_SCAN_PATHS]
    findings = scan(repo, roots)
    if findings:
        print("grokbit-document: doc-drift found after this edit (advisory — see CI for enforcement)\n")
        print_report(findings)
    return 0


def main() -> int:
    force_utf8_stdio()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--path", default=None,
                    help="directory or file to scan (default: docs/, README.md, CHANGELOG.md, "
                         "CONTRIBUTING.md, .grokbit/context/)")
    ap.add_argument("--repo", default=".", help="repository root")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--ci", action="store_true", help="exit 1 when any finding exists")
    ap.add_argument("--hook", action="store_true",
                    help="PostToolUse hook mode: read the tool payload from stdin, filter by "
                         "edited path, print only if findings exist, always exit 0")
    a = ap.parse_args()

    repo = Path(a.repo).resolve()
    if not repo.is_dir():
        print(f"no such repository root: {repo}", file=sys.stderr)
        return 2

    if a.hook:
        return run_hook(repo)

    if shutil.which("git") is None:
        print("git is not installed or not on PATH — drift detection needs it", file=sys.stderr)
        return 2
    if git("rev-parse", "--git-dir", cwd=repo) is None:
        print("not a git repository — drift detection needs history", file=sys.stderr)
        return 2

    if a.path is not None:
        root = repo / a.path
        if not root.exists():
            print(f"no such path: {root}", file=sys.stderr)
            return 2
        roots = [root]
    else:
        roots = [repo / p for p in DEFAULT_SCAN_PATHS]

    findings = scan(repo, roots)

    if a.json:
        print(json.dumps([asdict(f) for f in findings], indent=2))
    else:
        print_report(findings)

    return 1 if (findings and a.ci) else 0


if __name__ == "__main__":
    sys.exit(main())
