---
name: rebuild
description: >
  Rebuild of the Grokbit VS Code extension: bump package.json patch, package a
  fresh .vsix, reinstall into VS Code, and publish that build to the VS Code
  Marketplace. Use when the user runs /rebuild, /install-local, says "rebuild
  the extension", "install locally", "package and reinstall", "publish to
  marketplace", or wants the working tree live in the editor and on the
  Marketplace. Prefer npm run rebuild over raw install.ps1/install.sh paths.
---

# Skill: Rebuild (local install + Marketplace publish)

## What this is

**Full rebuild** — bump → package → reinstall into VS Code → publish to Marketplace.

| Not this | That is |
|----------|---------|
| GitHub Release + tag | `scripts/release.ps1` / `release.sh` |
| Open VSX publish | still separate (`ovsx` / manual) |
| Full agentic feature loop | `/ship <task>` (plan → implement → review → commit) |

## When to run

- User says `/rebuild`, "rebuild", "install the extension", "make it live in VS Code"
- User wants the latest working tree on the **VS Code Marketplace**
- After UI/code changes that need a fresh vsix in the installed host **and** the listing
- **Package last:** finish doc + code edits first so the vsix does not ship a stale snapshot

## Auth (required for the publish step)

Marketplace publish needs a Personal Access Token:

1. Azure DevOps → Personal access tokens → scope **Marketplace → Manage**
2. Set in the shell (preferred for agents / CI-like shells):

   ```powershell
   $env:VSCE_PAT = "<token>"
   ```

   ```bash
   export VSCE_PAT="<token>"
   ```

3. Or one-time interactive login:

   ```bash
   npx "@vscode/vsce" login Grokbit
   ```

Without auth, steps 1–3 still complete only if you pass **`-NoPublish` / `--no-publish`**; a default rebuild **fails** on publish when auth is missing.

## Steps

1. **Confirm scope** — working tree is the intended build; no need to commit first (rebuild does not commit).
2. **Run the cross-platform entry** from the repo root (preferred):

   ```bash
   npm run rebuild
   ```

   Local-only (skip Marketplace):

   ```bash
   npm run rebuild -- --no-publish
   # Windows also accepts: npm run rebuild -- -NoPublish
   ```

   Equivalents (same contract):

   - Windows: `pwsh scripts\install.ps1` (optional `-NoPublish`)
   - macOS / Linux / WSL: `./scripts/install.sh` (optional `--no-publish`)

3. **What the script does** (do not reimplement):
   - `python scripts/bump_extension_version.py` — patch +1 on `package.json`
   - `npm run package` — fresh `grokbit-*.vsix` (clears older vsix first)
   - `code --install-extension <vsix> --force` (or `code-insiders`)
   - `npx @vscode/vsce publish --packagePath <vsix>` — same artifact to Marketplace  
     (uses `VSCE_PAT` when set; skipped only with `-NoPublish` / `--no-publish`)

4. **Report back**:
   - New `package.json` version
   - Path of the built `.vsix` if printed
   - Whether Marketplace publish succeeded (or was skipped with `--no-publish`)
   - Remind: **Developer: Reload Window** (or restart the extension host) so the new build loads
   - Note that git tag / GitHub Release / Open VSX were **not** done

## Failure handling

- Missing `code` CLI → tell user to install VS Code or add `code` to PATH
- Missing Python / npm / vsce failures → show the script error; do not invent a partial install path
- Publish auth failure → show the script’s auth hint; do **not** claim Marketplace was updated; offer `npm run rebuild -- --no-publish` for local-only
- Do **not** treat `npm run package` alone as a rebuild — reinstall is mandatory; default rebuild also requires publish

## Do not

- Push or tag unless the user explicitly asks
- Skip the version bump on a true rebuild
- Skip Marketplace publish on a true rebuild unless the user asked for local-only or passed `--no-publish`
- Confuse this with `/ship` (product change loop) or release scripts
