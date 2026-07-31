#!/usr/bin/env python3
"""Deploy / update this template's operational assets into target projects.

Copies a fixed, codified set of files from this repo (the "template") into one
or more target project directories, under an explicit four-bucket overwrite
policy so the installer is safe to re-run against actively-developed projects:

- **TEMPLATE_OWNED** (create/update, hash-compared against a per-target
  manifest): ``.claude/agents/``, ``.claude/commands/``, ``.claude/skills/``,
  ``.claude/hooks/*.sh``, ``scripts/aggregate_token_usage.py``,
  ``scripts/deploy_template.py``. A target file whose content still matches
  what was last deployed (per the manifest) is refreshed silently; a target
  file that has been *locally edited* since the last deploy is backed up
  before being refreshed, so nothing is ever silently discarded.
- **SEED_IF_MISSING** (write only when absent, never touched again):
  ``CLAUDE.md``, ``.mcp.json``, ``docs/metrics/README.md``,
  ``.claude/settings.local.json.example``, plus ``.gitignore`` (special-cased:
  missing template lines are appended, existing content is never rewritten).
- **SETTINGS** (special-cased): ``.claude/settings.json``. Absent -> write the
  template's settings.json. Present -> perform an additive structural merge
  that injects the full template hook set, inserting each hook's ``command``
  only if that exact command string isn't already present anywhere in the
  target's hooks config. Existing hooks/permissions/keys are preserved
  untouched. Unparseable JSON is left alone (``manual-merge-needed``).
- **NEVER_TOUCH**: everything else (source code, other docs, logs/cache,
  ``.claude/settings.local.json``, the deprecated commit-metrics scripts,
  etc.) -- simply not on the deployable manifest built below.

Every overwritten/merged file is backed up first to
``<target>/.claude/.template-backups/<run-timestamp>/<relpath>``. Each install
writes ``<target>/.claude/.template-manifest.json`` (per-file sha256 + the
template version), which is what makes re-runs idempotent and lets the
installer tell "unchanged" apart from "locally edited".

Stdlib only. Cross-platform. Never runs ``git``.

Usage:
  python scripts/deploy_template.py --targets C:\\path\\a,C:\\path\\b --dry-run
      Print the per-file action plan for two targets. Writes nothing.

  python scripts/deploy_template.py --all --root C:\\Users\\me\\Projects --exclude claude-code-ultimate-template --dry-run
      Discover every immediate subdirectory of --root (skipping this repo)
      and print the plan for each. Writes nothing.

  python scripts/deploy_template.py --all --root C:\\Users\\me\\Projects --exclude claude-code-ultimate-template --yes
      Same discovery, for real. --yes is required for a real (non-dry-run)
      --all run.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

MANIFEST_FILENAME = ".template-manifest.json"
BACKUPS_DIRNAME = ".template-backups"

BUCKET_TEMPLATE_OWNED = "TEMPLATE_OWNED"
BUCKET_SEED_IF_MISSING = "SEED_IF_MISSING"
BUCKET_SETTINGS = "SETTINGS"

ACTION_CREATE = "create"
ACTION_UPDATE = "update"
ACTION_SKIP_UNCHANGED = "skip-unchanged"
ACTION_SEED_SKIPPED_EXISTS = "seed-skipped-exists"
ACTION_CONFLICT_BACKUP = "conflict-backup"
ACTION_MANUAL_MERGE_NEEDED = "manual-merge-needed"

ACTIONS_ORDER = [
    ACTION_CREATE,
    ACTION_UPDATE,
    ACTION_SKIP_UNCHANGED,
    ACTION_SEED_SKIPPED_EXISTS,
    ACTION_CONFLICT_BACKUP,
    ACTION_MANUAL_MERGE_NEEDED,
]

SEED_FILES = (
    "CLAUDE.md",
    ".mcp.json",
    "docs/metrics/README.md",
    ".claude/settings.local.json.example",
)
HOOK_SCRIPTS = ("aggregate_token_usage.py", "deploy_template.py")


@dataclass
class PlannedAction:
    relpath: str  # posix-style, relative to the target root
    bucket: str
    action: str
    src_path: Optional[Path] = None  # None when nothing needs writing


@dataclass
class TargetResult:
    target_root: Path
    plans: list
    counts: dict
    manifest_path: Optional[Path]


# -- hashing / manifest -----------------------------------------------------


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> Optional[str]:
    try:
        return sha256_bytes(path.read_bytes())
    except OSError:
        return None


def read_template_version(template_root: Path) -> str:
    try:
        return (template_root / "VERSION").read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"


def load_manifest(target_root: Path) -> Optional[dict]:
    manifest_path = target_root / ".claude" / MANIFEST_FILENAME
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def manifest_hash_for(manifest: Optional[dict], relpath: str) -> Optional[str]:
    if not manifest:
        return None
    for entry in manifest.get("files", []):
        if isinstance(entry, dict) and entry.get("path") == relpath:
            return entry.get("sha256")
    return None


def write_manifest(target_root: Path, template_root: Path, file_hashes: dict) -> Path:
    files = [
        {"path": relpath, "sha256": digest, "bucket": bucket}
        for relpath, (digest, bucket) in sorted(file_hashes.items())
    ]
    manifest = {
        "template_version": read_template_version(template_root),
        "installed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_repo": str(template_root.resolve()),
        "files": files,
    }
    manifest_path = target_root / ".claude" / MANIFEST_FILENAME
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(manifest, indent=2) + "\n")
    return manifest_path


def backup_file(target_root: Path, relpath: Path, run_stamp: str) -> Path:
    src = target_root / relpath
    dest = target_root / ".claude" / BACKUPS_DIRNAME / run_stamp / relpath
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return dest


# -- deployable manifest (what we manage) ------------------------------------


def iter_dir_files(root: Path) -> Iterator[Path]:
    if not root.exists():
        return
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def build_deployable_files(template_root: Path) -> list:
    """Return [(relpath, bucket)] for every plain (non-special-cased) path the
    installer manages, relative to *template_root*. ``.claude/settings.json``
    and ``.gitignore`` are handled separately (see plan_settings/plan_gitignore)
    because their merge logic differs from a plain create/update/seed."""
    entries: list = []

    for dirname in ("agents", "commands", "skills"):
        for path in iter_dir_files(template_root / ".claude" / dirname):
            entries.append((path.relative_to(template_root), BUCKET_TEMPLATE_OWNED))

    hooks_dir = template_root / ".claude" / "hooks"
    if hooks_dir.exists():
        for path in sorted(hooks_dir.glob("*.sh")):
            if path.is_file():
                entries.append((path.relative_to(template_root), BUCKET_TEMPLATE_OWNED))

    for name in HOOK_SCRIPTS:
        path = template_root / "scripts" / name
        if path.is_file():
            entries.append((path.relative_to(template_root), BUCKET_TEMPLATE_OWNED))

    for rel in SEED_FILES:
        path = template_root / rel
        if path.is_file():
            entries.append((Path(rel), BUCKET_SEED_IF_MISSING))

    return entries


# -- per-file planning --------------------------------------------------------


def plan_template_owned(
    template_root: Path, target_root: Path, relpath: Path, manifest: Optional[dict]
) -> PlannedAction:
    rel_str = relpath.as_posix()
    src = template_root / relpath
    dst = target_root / relpath
    new_hash = sha256_file(src)
    if not dst.exists():
        return PlannedAction(rel_str, BUCKET_TEMPLATE_OWNED, ACTION_CREATE, src)
    dst_hash = sha256_file(dst)
    if dst_hash == new_hash:
        return PlannedAction(rel_str, BUCKET_TEMPLATE_OWNED, ACTION_SKIP_UNCHANGED, None)
    old_hash = manifest_hash_for(manifest, rel_str)
    if old_hash is not None and old_hash == dst_hash:
        # Unmodified since the last deploy; the template's content changed.
        return PlannedAction(rel_str, BUCKET_TEMPLATE_OWNED, ACTION_UPDATE, src)
    # Diverges from what we last deployed (or we have no record at all) --
    # treat as a local edit and never silently discard it.
    return PlannedAction(rel_str, BUCKET_TEMPLATE_OWNED, ACTION_CONFLICT_BACKUP, src)


def plan_seed_if_missing(template_root: Path, target_root: Path, relpath: Path) -> PlannedAction:
    rel_str = relpath.as_posix()
    dst = target_root / relpath
    if dst.exists():
        return PlannedAction(rel_str, BUCKET_SEED_IF_MISSING, ACTION_SEED_SKIPPED_EXISTS, None)
    return PlannedAction(rel_str, BUCKET_SEED_IF_MISSING, ACTION_CREATE, template_root / relpath)


def apply_action(target_root: Path, plan: PlannedAction, run_stamp: str) -> Optional[str]:
    dst = target_root / plan.relpath
    if plan.action in (ACTION_UPDATE, ACTION_CONFLICT_BACKUP):
        backup_file(target_root, Path(plan.relpath), run_stamp)
    if plan.action in (ACTION_CREATE, ACTION_UPDATE, ACTION_CONFLICT_BACKUP):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(plan.src_path, dst)
        return sha256_file(dst)
    # skip-unchanged / seed-skipped-exists: nothing written, report what's there.
    return sha256_file(dst) if dst.exists() else None


# -- .claude/settings.json (additive merge, Decision #2) --------------------


def collect_commands(hooks_config) -> set:
    """Every hook "command" string appearing anywhere in a hooks config."""
    commands: set = set()
    if not isinstance(hooks_config, dict):
        return commands
    for groups in hooks_config.values():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            for hook in group.get("hooks", []) or []:
                if isinstance(hook, dict) and isinstance(hook.get("command"), str):
                    commands.add(hook["command"])
    return commands


def merge_settings(target: dict, template: dict) -> tuple:
    """Additively merge the template's full hook set into *target* (Decision
    #2): every template hook is inserted unless its exact ``command`` string
    already exists anywhere in the target's hooks config. Existing hooks,
    permissions, and every other top-level key are left untouched. Returns
    (merged_dict, changed_bool)."""
    merged = copy.deepcopy(target)
    template_hooks = template.get("hooks", {})
    if not isinstance(template_hooks, dict):
        return merged, False

    merged_hooks = merged.get("hooks")
    if merged_hooks is None:
        merged_hooks = {}
        merged["hooks"] = merged_hooks
    if not isinstance(merged_hooks, dict):
        # Malformed existing "hooks" key -- nothing safe to merge into.
        return merged, False

    existing_commands = collect_commands(merged_hooks)
    changed = False

    for event_name, groups in template_hooks.items():
        if not isinstance(groups, list):
            continue
        target_groups = merged_hooks.get(event_name)
        if target_groups is None:
            target_groups = []
            merged_hooks[event_name] = target_groups
        elif not isinstance(target_groups, list):
            # Malformed existing event value -- leave it untouched, skip event.
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            matcher = group.get("matcher")
            hook_entries = group.get("hooks", []) or []
            new_entries = [
                copy.deepcopy(h)
                for h in hook_entries
                if isinstance(h, dict) and h.get("command") not in existing_commands
            ]
            if not new_entries:
                continue
            match_group = next(
                (g for g in target_groups if isinstance(g, dict) and g.get("matcher") == matcher),
                None,
            )
            if match_group is None:
                match_group = {"matcher": matcher, "hooks": []} if matcher is not None else {"hooks": []}
                target_groups.append(match_group)
            hooks_list = match_group.setdefault("hooks", [])
            if not isinstance(hooks_list, list):
                # The matched group's "hooks" is malformed; add a fresh group
                # rather than touching it.
                match_group = {"matcher": matcher, "hooks": []} if matcher is not None else {"hooks": []}
                target_groups.append(match_group)
                hooks_list = match_group["hooks"]
            hooks_list.extend(new_entries)
            for entry in new_entries:
                existing_commands.add(entry.get("command"))
            changed = True

    return merged, changed


def plan_settings(template_root: Path, target_root: Path) -> tuple:
    rel = ".claude/settings.json"
    template_settings = json.loads((template_root / ".claude" / "settings.json").read_text(encoding="utf-8"))
    dst = target_root / ".claude" / "settings.json"
    if not dst.exists():
        return PlannedAction(rel, BUCKET_SETTINGS, ACTION_CREATE, None), template_settings
    try:
        target_settings = json.loads(dst.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return PlannedAction(rel, BUCKET_SETTINGS, ACTION_MANUAL_MERGE_NEEDED, None), None
    if not isinstance(target_settings, dict):
        return PlannedAction(rel, BUCKET_SETTINGS, ACTION_MANUAL_MERGE_NEEDED, None), None
    merged, changed = merge_settings(target_settings, template_settings)
    if not changed:
        return PlannedAction(rel, BUCKET_SETTINGS, ACTION_SKIP_UNCHANGED, None), None
    return PlannedAction(rel, BUCKET_SETTINGS, ACTION_UPDATE, None), merged


def apply_settings(target_root: Path, plan: PlannedAction, payload: Optional[dict], run_stamp: str) -> Optional[str]:
    dst = target_root / ".claude" / "settings.json"
    if plan.action == ACTION_CREATE:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(payload, indent=2) + "\n")
        return sha256_file(dst)
    if plan.action == ACTION_UPDATE:
        backup_file(target_root, Path(".claude/settings.json"), run_stamp)
        with dst.open("w", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(payload, indent=2) + "\n")
        return sha256_file(dst)
    if plan.action == ACTION_MANUAL_MERGE_NEEDED:
        return None
    # skip-unchanged
    return sha256_file(dst) if dst.exists() else None


# -- .gitignore (additive append) --------------------------------------------


def plan_gitignore(template_root: Path, target_root: Path) -> tuple:
    rel = ".gitignore"
    template_lines = (template_root / ".gitignore").read_text(encoding="utf-8").splitlines()
    dst = target_root / ".gitignore"
    if not dst.exists():
        return PlannedAction(rel, BUCKET_SEED_IF_MISSING, ACTION_CREATE, None), template_lines
    existing_lines = set(dst.read_text(encoding="utf-8").splitlines())
    missing = [line for line in template_lines if line not in existing_lines]
    if not missing:
        return PlannedAction(rel, BUCKET_SEED_IF_MISSING, ACTION_SKIP_UNCHANGED, None), None
    return PlannedAction(rel, BUCKET_SEED_IF_MISSING, ACTION_UPDATE, None), missing


def apply_gitignore(target_root: Path, plan: PlannedAction, payload: Optional[list], run_stamp: str) -> Optional[str]:
    dst = target_root / ".gitignore"
    if plan.action == ACTION_CREATE:
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(payload) + "\n")
        return sha256_file(dst)
    if plan.action == ACTION_UPDATE:
        backup_file(target_root, Path(".gitignore"), run_stamp)
        existing = dst.read_text(encoding="utf-8").rstrip("\n")
        block = "\n".join(payload)
        new_text = f"{existing}\n\n{block}\n" if existing else f"{block}\n"
        with dst.open("w", encoding="utf-8", newline="\n") as f:
            f.write(new_text)
        return sha256_file(dst)
    # skip-unchanged
    return sha256_file(dst) if dst.exists() else None


# -- per-target orchestration -------------------------------------------------


def deploy_target(template_root: Path, target_root: Path, run_stamp: str, dry_run: bool) -> TargetResult:
    deployable = build_deployable_files(template_root)
    manifest = load_manifest(target_root)

    plans: list = []
    file_hashes: dict = {}

    for relpath, bucket in deployable:
        if bucket == BUCKET_TEMPLATE_OWNED:
            plan = plan_template_owned(template_root, target_root, relpath, manifest)
        else:
            plan = plan_seed_if_missing(template_root, target_root, relpath)
        plans.append(plan)
        if not dry_run:
            digest = apply_action(target_root, plan, run_stamp)
            if digest is not None:
                file_hashes[plan.relpath] = (digest, plan.bucket)

    settings_plan, settings_payload = plan_settings(template_root, target_root)
    plans.append(settings_plan)
    if not dry_run:
        digest = apply_settings(target_root, settings_plan, settings_payload, run_stamp)
        if digest is not None:
            file_hashes[settings_plan.relpath] = (digest, settings_plan.bucket)

    gitignore_plan, gitignore_payload = plan_gitignore(template_root, target_root)
    plans.append(gitignore_plan)
    if not dry_run:
        digest = apply_gitignore(target_root, gitignore_plan, gitignore_payload, run_stamp)
        if digest is not None:
            file_hashes[gitignore_plan.relpath] = (digest, gitignore_plan.bucket)

    counts: dict = {}
    for plan in plans:
        counts[plan.action] = counts.get(plan.action, 0) + 1

    manifest_path = None
    if not dry_run:
        manifest_path = write_manifest(target_root, template_root, file_hashes)

    return TargetResult(target_root=target_root, plans=plans, counts=counts, manifest_path=manifest_path)


def print_target_report(target: Path, result: TargetResult, dry_run: bool) -> None:
    print(f"== {target} ==")
    for plan in sorted(result.plans, key=lambda p: p.relpath):
        print(f"  {plan.action:<22} {plan.relpath}")
    summary = ", ".join(f"{action}={result.counts[action]}" for action in ACTIONS_ORDER if action in result.counts)
    print(f"  -- {summary}")
    if not dry_run and result.manifest_path is not None:
        print(f"  manifest: {result.manifest_path}")
    print()


# -- target discovery (--all) -------------------------------------------------


def discover_targets(root: Path, exclude_names: set, template_root: Path) -> list:
    if not root.is_dir():
        raise SystemExit(f"error: --root is not a directory: {root}")
    template_resolved = template_root.resolve()
    targets: list = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if child.name.lower() in exclude_names:
            continue
        try:
            if child.resolve() == template_resolved:
                continue
        except OSError:
            continue
        if not os.access(child, os.W_OK):
            continue
        targets.append(child)
    return targets


# -- CLI -----------------------------------------------------------------------


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Deploy/update this template's operational assets (.claude/agents, commands, "
            "skills, hooks, scripts, and a few seeded docs) into target project directories "
            "under a safe, idempotent overwrite policy."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the per-file action plan; write nothing.")
    parser.add_argument("--targets", default=None, help="Comma-separated list of target project directories.")
    parser.add_argument(
        "--all", action="store_true", help="Discover targets as every immediate subdirectory of --root."
    )
    parser.add_argument("--root", type=Path, default=None, help="Root directory to discover targets under (with --all).")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Comma-separated target directory name(s) to skip when using --all. Repeatable.",
    )
    parser.add_argument("--yes", action="store_true", help="Required to perform a real (non-dry-run) --all run.")
    parser.add_argument("--template-root", type=Path, default=REPO_ROOT, help=argparse.SUPPRESS)
    return parser


def resolve_targets(args) -> list:
    ordered: dict = {}

    def add(path: Path) -> None:
        try:
            key = path.resolve()
        except OSError:
            key = path
        ordered.setdefault(key, path)

    if args.targets:
        for raw in args.targets.split(","):
            raw = raw.strip()
            if raw:
                add(Path(raw))

    if args.all:
        if not args.root:
            raise SystemExit("error: --all requires --root")
        exclude_names: set = set()
        for group in args.exclude:
            for name in group.split(","):
                name = name.strip()
                if name:
                    exclude_names.add(name.lower())
        for child in discover_targets(args.root, exclude_names, args.template_root):
            add(child)

    return list(ordered.values())


def main(argv: Optional[list] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if not args.targets and not args.all:
        parser.error("specify --targets and/or --all")

    if args.all and not args.dry_run and not args.yes:
        parser.error("--yes is required for a real (non-dry-run) --all run")

    template_root = args.template_root.resolve()

    try:
        targets = resolve_targets(args)
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        return 2

    if not targets:
        print("no targets found", file=sys.stderr)
        return 1

    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    total_counts: dict = {}
    had_error = False

    for target in targets:
        target = Path(target)
        if not target.is_dir():
            print(f"error: target does not exist or is not a directory: {target}", file=sys.stderr)
            had_error = True
            continue
        try:
            result = deploy_target(template_root, target.resolve(), run_stamp, args.dry_run)
        except Exception as exc:  # one bad target must not abort the whole run
            print(f"error: deploy failed for {target}: {exc}", file=sys.stderr)
            had_error = True
            continue
        print_target_report(target, result, args.dry_run)
        for action, count in result.counts.items():
            total_counts[action] = total_counts.get(action, 0) + count

    if len(targets) > 1:
        print("=== grand total across all targets ===")
        for action in ACTIONS_ORDER:
            if action in total_counts:
                print(f"  {action:<22} {total_counts[action]}")
        print()

    if args.dry_run:
        print("dry run: no files were written")

    return 1 if had_error else 0


if __name__ == "__main__":
    sys.exit(main())
