---
name: codebase-scan
description: A quick read-only health scan of the repository — surfaces TODO/FIXME/HACK markers, oversized files, potential secret-looking strings, and rough structure/size signals. Use when you want a fast lay-of-the-land or a maintenance snapshot without reading everything yourself. Runs in an isolated context so its verbose output doesn't clutter the main conversation.
context: fork
allowed-tools: Read, Grep, Glob, Bash(git ls-files:*)
argument-hint: "[optional: a subdirectory to scope the scan to]"
---

# Codebase health scan

Read-only. Produce a concise snapshot, not an exhaustive dump. Scope: **$ARGUMENTS**
(default: the whole repo). Because this skill runs in a forked context, do the noisy
gathering here and return only the summary.

Gather (skip vendored/build dirs like `node_modules`, `dist`, `build`, `.venv`,
`target`):
1. **Size & shape**: count tracked files by extension (`git ls-files`), and identify
   the 10 largest source files by line count.
2. **Markers**: count and locate `TODO`, `FIXME`, `HACK`, `XXX` comments
   (`path:line`), grouped by type. List up to ~20 of the most relevant.
3. **Possible secrets** (heuristic, report don't exfiltrate): grep for patterns like
   `API_KEY`, `SECRET`, `PASSWORD`, `BEGIN PRIVATE KEY`, `AKIA[0-9A-Z]{16}`,
   long base64-ish literals assigned to suspicious names. Report only the `path:line`
   and the variable name — never the value. Flag for human review; these are leads,
   not confirmed leaks.
4. **Smell signals** (lightweight): very long files/functions, deeply nested
   directories, or unusually large single modules worth a closer look.

Return a tight report:
- **Overview**: file/line totals and the dominant languages.
- **Hotspots**: largest files and the heaviest directories.
- **Markers**: counts + the notable TODO/FIXME/HACK locations.
- **Secret-scan leads**: locations to review by hand (no values), or "none found".
- **Suggested follow-ups**: the few highest-value cleanups, ranked.

Keep it scannable. This is a triage snapshot to decide where to look next.
