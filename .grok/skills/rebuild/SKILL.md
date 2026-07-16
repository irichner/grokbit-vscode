---
name: rebuild
description: >
  Local rebuild of the Grokbit VS Code extension: bump package.json patch,
  package a fresh .vsix, and reinstall into VS Code (not Marketplace publish).
  Use when the user runs /rebuild, /install-local, says "rebuild the extension",
  "install locally", "package and reinstall", or wants the working tree live in
  the editor. Prefer npm run rebuild over raw install.ps1/install.sh paths.
---

# Skill: Rebuild (local install)

## What this is

**Local rebuild only** — bump → package → reinstall into VS Code.

| Not this | That is |
|----------|---------|
| Marketplace / Open VSX publish | `npm run publish` (user-initiated) |
| GitHub Release + tag | `scripts/release.ps1` / `release.sh` |
| Full agentic feature loop | `/ship <task>` (plan → implement → review → commit) |

## When to run

- User says `/rebuild`, "rebuild", "install the extension", "make it live in VS Code"
- After UI/code changes that need a fresh vsix in the installed host
- **Package last:** finish doc + code edits first so the vsix does not ship a stale snapshot

## Steps

1. **Confirm scope** — working tree is the intended build; no need to commit first (rebuild does not commit).
2. **Run the cross-platform entry** from the repo root (preferred):

   ```bash
   npm run rebuild
   ```

   Equivalents (same contract):

   - Windows: `pwsh scripts\install.ps1`
   - macOS / Linux / WSL: `./scripts/install.sh`

3. **What the script does** (do not reimplement):
   - `python scripts/bump_extension_version.py` — patch +1 on `package.json`
   - `npm run package` — fresh `grokbit-*.vsix` (clears older vsix first)
   - `code --install-extension <vsix> --force` (or `code-insiders`)

4. **Report back**:
   - New `package.json` version
   - Path of the built `.vsix` if printed
   - Remind: **Developer: Reload Window** (or restart the extension host) so the new build loads
   - Note that Marketplace publish / git tag / GitHub Release were **not** done

## Failure handling

- Missing `code` CLI → tell user to install VS Code or add `code` to PATH
- Missing Python / npm / vsce failures → show the script error; do not invent a partial install path
- Do **not** treat `npm run package` alone as a rebuild — reinstall is mandatory

## Do not

- Push, tag, or `npm run publish` unless the user explicitly asks
- Skip the version bump on a true rebuild
- Confuse this with `/ship` (product change loop) or release scripts
