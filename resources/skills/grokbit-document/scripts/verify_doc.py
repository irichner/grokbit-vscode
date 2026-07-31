#!/usr/bin/env python3
"""
verify_doc.py — check that a document is actually true.

Resolves every file path and internal link (including anchors), validates the
document's own provenance citations, does a best-effort syntax check on code
samples, and collects every shell command so they can be run against a real
environment. A quickstart whose first command fails is the most common
documentation defect there is, and unlike most defects it is entirely
automatable.

    python3 verify_doc.py README.md              # static checks + list commands
    python3 verify_doc.py README.md --execute --i-understand-this-runs-shell
    python3 verify_doc.py docs/ --json
    python3 verify_doc.py README.md --checks paths_resolve,links_follow

SAFETY: --execute runs shell commands extracted from a text file, with the
full inherited environment and network access — there is no sandbox, and
this script does not build one. Only ever use it inside a disposable
container or CI runner, on documents you trust. Because there is no way for
this script to verify it is actually inside one, it refuses to run anything
unless it detects a container/CI environment (`/.dockerenv`, or `CI`,
`CONTAINER`, `REMOTE_CONTAINERS`, `CODESPACES` set) OR you pass
--i-understand-this-runs-shell to say you already checked. Without --execute
nothing is run; commands are listed for review. Mark a fence that must never
run — a destructive example, a placeholder command — with a
`<!-- doc-verify:skip -->` comment on the line immediately above it; it is
still reported, just never executed.

CHECKS: --checks selects a comma-separated subset of {commands_run,
paths_resolve, links_follow, samples_compile, citations_valid} (default: all
of them). Every check this script advertises is implemented — there is no
selectable check that silently does nothing.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

ALL_CHECKS = ("commands_run", "paths_resolve", "links_follow", "samples_compile", "citations_valid")

# Pure scripts: the whole fenced block IS the command, no prompt to strip.
SCRIPT_LANGS = {"sh", "bash", "shell", "zsh"}

CONSOLE_PROMPT = re.compile(r"^\s*[$>]\s?")
PS_PROMPT = re.compile(r"^\s*PS(?:\s+\S*)?>\s?")
CMD_PROMPT = re.compile(r"^\s*[A-Za-z]:\\[^\r\n]*?>\s?")

# Transcript langs: only the prompted lines are commands; everything else in
# the fence is captured output and gets dropped rather than "run".
TRANSCRIPT_LANGS = {
    "console": CONSOLE_PROMPT,
    "powershell": PS_PROMPT,
    "ps1": PS_PROMPT,
    "cmd": CMD_PROMPT,
    "bat": CMD_PROMPT,
}

SHELL_LANGS = SCRIPT_LANGS | set(TRANSCRIPT_LANGS)

COMPILE_LANGS = {"python", "py"}
# Recognized as an intentional standalone code sample but not one this
# stdlib-only script can actually compile/parse — disclosed, never silently
# passed. Deliberately excludes blank/prose/output/shell/diff/mermaid fences,
# which are not samples at all (see check_samples).
CODE_SAMPLE_LANGS = {
    "js", "javascript", "jsx", "ts", "typescript", "tsx",
    "go", "rust", "rs", "java", "c", "cpp", "cs", "csharp",
    "rb", "ruby", "php", "kotlin", "swift", "yaml", "yml", "toml", "sql",
}

FENCE = re.compile(r"^```(\w*)")
SKIP_DIRECTIVE = re.compile(r"^\s*<!--\s*doc-verify:\s*skip\s*-->\s*$")
MD_LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
REF_LINK = re.compile(r"\[([^\]]*)\]\[([^\]]*)\]")
REF_DEF = re.compile(r"^\s*\[([^\]]+)\]:\s*(\S+)", re.MULTILINE)
HEADING = re.compile(r"^(#{1,6})\s+(.*)")
INLINE_PATH = re.compile(r"`([\w./-]+\.[a-zA-Z]{1,5})`")
SKIP_PREFIX = ("http://", "https://", "mailto:", "#", "<")
FRONTMATTER = "---"

KNOWN_EXTS = {
    "md", "txt", "json", "yml", "yaml", "toml", "ts", "tsx", "js", "jsx", "py",
    "rs", "go", "java", "rb", "c", "cpp", "h", "hpp", "cs", "php", "sh", "ps1",
    "sql", "css", "scss", "html", "xml", "ini", "cfg", "env", "lock", "csv",
    "png", "jpg", "jpeg", "svg", "gif", "pdf", "vsix",
}

EXCLUDED_DIRS = {
    "node_modules", ".git", "dist", "build", "out", "vendor",
    ".venv", "venv", "__pycache__", "target", ".next", ".turbo",
}


@dataclass
class Finding:
    kind: str        # command | path | link | sample | citation | read
    severity: str    # BLOCKER | MAJOR | MINOR | OK | PENDING
    detail: str
    line: int = 0


def force_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def looks_containerized() -> bool:
    if Path("/.dockerenv").exists():
        return True
    return any(os.environ.get(v) for v in ("CI", "CONTAINER", "REMOTE_CONTAINERS", "CODESPACES"))


def read_doc(doc: Path) -> tuple[str | None, Finding | None]:
    try:
        return doc.read_text(encoding="utf-8-sig"), None
    except FileNotFoundError:
        return None, Finding("read", "BLOCKER", f"document not found: {doc}")
    except UnicodeDecodeError as e:
        return None, Finding("read", "BLOCKER", f"cannot decode as UTF-8: {e}")
    except OSError as e:
        return None, Finding("read", "BLOCKER", f"cannot read document: {e}")


def parse_frontmatter(text: str) -> dict:
    """Same minimal, defensive YAML subset as check_drift.py. Duplicated
    rather than imported so this script stays a single self-contained file
    a user can copy anywhere — see the house convention of copy-pasteable,
    no-shared-state commands this skill asks of its own generated docs."""
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
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [str(v) for v in value if str(v).strip()]


def blocks(text: str) -> list[tuple[str, str, int, bool]]:
    """Fenced code blocks as (lang, body, first-body-line-no, skip). `skip`
    is set when the line immediately before the opening fence is a
    `<!-- doc-verify:skip -->` directive."""
    lines = text.splitlines()
    out: list[tuple[str, str, int, bool]] = []
    lang, buf, start = None, [], 0
    for i, line in enumerate(lines, 1):
        m = FENCE.match(line)
        if m and lang is None:
            lang, buf, start = m.group(1).lower(), [], i
        elif line.startswith("```") and lang is not None:
            skip = start >= 2 and bool(SKIP_DIRECTIVE.match(lines[start - 2]))
            out.append((lang, "\n".join(buf), start, skip))
            lang = None
        elif lang is not None:
            buf.append(line)
    return out


def command_blocks(text: str) -> list[tuple[str, str, int, bool]]:
    """One entry per fenced block whose language is in SHELL_LANGS. The whole
    block runs as ONE script — never split into separate per-line
    invocations, which is what broke `cd backend` + `npm test` running in
    different processes and what split heredocs/continuations mid-construct."""
    out = []
    for lang, body, start, skip in blocks(text):
        if lang not in SHELL_LANGS:
            continue
        if lang in TRANSCRIPT_LANGS:
            prompt = TRANSCRIPT_LANGS[lang]
            lines = [prompt.sub("", ln) for ln in body.splitlines() if prompt.match(ln)]
        else:
            lines = body.splitlines()
        script = "\n".join(lines).strip()
        if script:
            out.append((lang, script, start + 1, skip))
    return out


def looks_like_path(token: str) -> bool:
    if "/" in token or token.startswith("./") or token.startswith("../"):
        return True
    ext = token.rsplit(".", 1)[-1].lower()
    return ext in KNOWN_EXTS


def check_paths(text: str, repo: Path) -> list[Finding]:
    out, seen = [], set()
    for m in INLINE_PATH.finditer(text):
        p = m.group(1)
        if p in seen or p.startswith(SKIP_PREFIX) or not looks_like_path(p):
            continue
        seen.add(p)
        line = text[: m.start()].count("\n") + 1
        if not (repo / p.lstrip("/")).exists():
            out.append(Finding("path", "MAJOR", f"path does not resolve: {p}", line))
    return out


def resolve_target(target: str, doc: Path, repo: Path) -> Path:
    """Repo-root-absolute links (`/docs/x.md`, the GitHub convention) resolve
    against the repo root; everything else resolves relative to the document
    itself. A bare pathlib join mishandles the leading-slash case on every
    OS — `Path("/docs/x.md")` discards the base entirely — and is worst on
    Windows, where it silently lands on the current drive's root instead."""
    if target.startswith("/"):
        return repo / target.lstrip("/")
    return doc.parent / target


def slugify(heading: str) -> str:
    h = heading.strip().lower()
    h = re.sub(r"`([^`]*)`", r"\1", h)
    h = re.sub(r"[^\w\- ]", "", h)
    h = re.sub(r"\s+", "-", h)
    return h


def heading_slugs(text: str) -> set[str]:
    slugs, in_fence = set(), False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = HEADING.match(line)
        if m:
            slugs.add(slugify(m.group(2)))
    return slugs


def parse_ref_defs(text: str) -> dict[str, str]:
    return {m.group(1).strip().lower(): m.group(2).strip().strip("<>")
            for m in REF_DEF.finditer(text)}


def check_links(text: str, doc: Path, repo: Path) -> list[Finding]:
    out: list[Finding] = []
    heading_cache: dict[str, set[str] | None] = {}
    refs = parse_ref_defs(text)

    def anchor_ok(fragment: str, candidate: Path) -> bool:
        key = str(candidate)
        if key not in heading_cache:
            try:
                heading_cache[key] = heading_slugs(candidate.read_text(encoding="utf-8-sig"))
            except (OSError, UnicodeDecodeError):
                heading_cache[key] = None
        slugs = heading_cache[key]
        return slugs is None or fragment in slugs

    def evaluate(raw_target: str, line: int) -> None:
        target = raw_target.strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "<")):
            return
        target_path, _, fragment = target.partition("#")
        # A pure `#fragment` target (target_path == "") is a same-page
        # anchor — it must still be validated, not skipped like the URL
        # prefixes above.
        candidate = doc if not target_path else resolve_target(target_path, doc, repo)
        if target_path and not candidate.exists():
            out.append(Finding("link", "BLOCKER", f"broken link: {target}", line))
            return
        if fragment and not anchor_ok(fragment, candidate):
            where = target_path or doc.name
            out.append(Finding("link", "BLOCKER", f"broken anchor: #{fragment} in {where}", line))

    for m in MD_LINK.finditer(text):
        evaluate(m.group(1), text[: m.start()].count("\n") + 1)

    for m in REF_LINK.finditer(text):
        ref = (m.group(2) or m.group(1)).strip().lower()
        target = refs.get(ref)
        if target is None:
            continue
        evaluate(target, text[: m.start()].count("\n") + 1)

    return out


def check_citations(text: str, repo: Path) -> list[Finding]:
    """`derived_from` frontmatter is this document's own provenance claim
    (see references/provenance.md). Every cited source must at least exist —
    whether it has since MOVED is check_drift.py's job, run over time, not
    this one-shot verification's."""
    try:
        fm = parse_frontmatter(text)
    except Exception:
        return [Finding("citation", "BLOCKER", "frontmatter could not be parsed")]
    entries = as_list(fm.get("derived_from"))
    out = []
    for entry in entries:
        src, _, _commit = entry.partition("@")
        src = src.strip()
        if src and not (repo / src).exists():
            out.append(Finding("citation", "BLOCKER", f"cited source does not resolve: {src}"))
    return out


def check_samples(text: str) -> list[Finding]:
    out = []
    for lang, body, start, skip in blocks(text):
        if skip or not body.strip():
            continue
        if lang in ("python", "py"):
            try:
                compile(body, "<sample>", "exec")
            except SyntaxError as e:
                out.append(Finding("sample", "BLOCKER",
                    f"python sample does not compile: {e.msg}", start + (e.lineno or 1)))
        elif lang == "json":
            try:
                json.loads(body)
            except json.JSONDecodeError as e:
                out.append(Finding("sample", "BLOCKER",
                    f"json sample is invalid: {e.msg}", start + e.lineno))
        elif lang in CODE_SAMPLE_LANGS:
            out.append(Finding("sample", "MINOR",
                f"samples_compile has no checker for '{lang}' — listed, not verified", start + 1))
    return out


def run(lang: str, script: str, cwd: Path, timeout: int) -> tuple[bool, str]:
    if lang in ("powershell", "ps1"):
        exe = shutil.which("pwsh") or shutil.which("powershell")
        if exe is None:
            return False, "interpreter not found: pwsh/powershell"
        argv, shell = [exe, "-NoProfile", "-NonInteractive", "-Command", script], False
    elif lang in ("cmd", "bat"):
        exe = shutil.which("cmd") or shutil.which("cmd.exe")
        if exe is None:
            return False, "interpreter not found: cmd"
        argv, shell = [exe, "/d", "/c", script], False
    else:
        argv, shell = script, True
    try:
        r = subprocess.run(argv, shell=shell, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0:
            tail = (r.stderr or r.stdout or "").strip().splitlines()
            return False, f"exit {r.returncode}: {tail[-1] if tail else 'no output'}"
        return True, "ok"
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout}s"
    except OSError as e:
        return False, str(e)


def verify(doc: Path, repo: Path, execute: bool, timeout: int, checks: set[str]) -> list[Finding]:
    text, err = read_doc(doc)
    if err:
        return [err]

    findings: list[Finding] = []
    if "paths_resolve" in checks:
        findings += check_paths(text, repo)
    if "links_follow" in checks:
        findings += check_links(text, doc, repo)
    if "citations_valid" in checks:
        findings += check_citations(text, repo)
    if "samples_compile" in checks:
        findings += check_samples(text)

    if "commands_run" in checks:
        for lang, script, line, skip in command_blocks(text):
            if skip:
                findings.append(Finding("command", "OK", f"skipped by doc-verify:skip directive: {script.splitlines()[0]}", line))
                continue
            if not execute:
                findings.append(Finding("command", "PENDING", f"not run (use --execute): {script.splitlines()[0]}", line))
                continue
            ok, why = run(lang, script, repo, timeout)
            findings.append(Finding("command", "OK" if ok else "BLOCKER", f"{script.splitlines()[0]}  ->  {why}", line))

    return findings


def discover_docs(target: Path) -> list[Path]:
    if target.is_file():
        return [target]
    return sorted(p for p in target.rglob("*.md") if not EXCLUDED_DIRS & set(p.parts))


def main() -> int:
    force_utf8_stdio()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="document or directory")
    ap.add_argument("--repo", default=".", help="repository root")
    ap.add_argument("--execute", action="store_true",
                    help="run documented commands — CONTAINERS/CI ONLY, see SAFETY above")
    ap.add_argument("--i-understand-this-runs-shell", action="store_true", dest="ack_shell",
                    help="required for --execute when no container/CI environment is detected")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--checks", default=",".join(ALL_CHECKS),
                    help=f"comma-separated checks to run (default: all). choices: {', '.join(ALL_CHECKS)}")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    checks = {c.strip() for c in a.checks.split(",") if c.strip()}
    unknown = checks - set(ALL_CHECKS)
    if unknown:
        print(f"unknown check(s): {', '.join(sorted(unknown))} — choices are {', '.join(ALL_CHECKS)}", file=sys.stderr)
        return 2

    if a.execute and not (looks_containerized() or a.ack_shell):
        print(
            "refusing --execute: no container/CI environment was detected and "
            "--i-understand-this-runs-shell was not passed.\n"
            "This runs real shell commands with the full inherited environment and network — "
            "there is no sandbox here. Run it inside a disposable container or CI runner, or "
            "pass --i-understand-this-runs-shell once you have verified you already are in one.",
            file=sys.stderr,
        )
        return 2

    repo = Path(a.repo).resolve()
    target = Path(a.target)
    if not target.exists():
        print(f"no such document or directory: {target}", file=sys.stderr)
        return 2
    docs = discover_docs(target)
    if not docs:
        print(f"no markdown found at {target}", file=sys.stderr)
        return 2

    report: dict[str, list[dict]] = {}
    blockers = 0
    pending = 0
    for doc in docs:
        fs = verify(doc, repo, a.execute, a.timeout, checks)
        report[doc.as_posix()] = [asdict(f) for f in fs]
        blockers += sum(1 for f in fs if f.severity == "BLOCKER")
        pending += sum(1 for f in fs if f.severity == "PENDING")

    mode = "executed" if a.execute else "listed"

    if a.json:
        print(json.dumps({"mode": mode, "results": report}, indent=2))
    else:
        for name, fs in report.items():
            bad = [f for f in fs if f["severity"] not in ("OK",)]
            print(f"\n{name}  —  {len(bad)} issue(s)")
            for f in fs:
                mark = {
                    "BLOCKER": "FAIL", "MAJOR": "WARN", "MINOR": "note", "PENDING": "PEND",
                }.get(f["severity"], "ok  ")
                print(f"  {mark}  L{f['line']:<4} {f['detail']}")
        if pending and not a.execute:
            print(
                "\nCommands were listed, not run — this is NOT the same as verified. "
                "Re-run with --execute (inside a container or CI, or with "
                "--i-understand-this-runs-shell) to actually verify them."
            )

    if blockers:
        return 1
    if pending and "commands_run" in checks:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
