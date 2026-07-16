#!/usr/bin/env bash
# Install / rebuild the Grokbit VS Code extension on macOS / Linux / WSL.
# Usage:  ./scripts/install.sh [path/to/file.vsix]
#
# Default (no argument) = full REBUILD contract (all three, always):
#   1. bump package.json patch  (scripts/bump_extension_version.py)
#   2. package a fresh .vsix    (npm run package; clears stale grokbit-*.vsix)
#   3. reinstall into VS Code   (code --install-extension … --force)
# Never package-only — this script always ends with a reinstall.
# Explicit vsix path skips bump/package and only installs that file.

set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

find_code_cli() {
    for name in code code-insiders; do
        if command -v "$name" >/dev/null 2>&1; then
            echo "$name"; return 0
        fi
    done
    # macOS install paths
    for path in \
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
        "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders" \
    ; do
        [ -x "$path" ] && { echo "$path"; return 0; }
    done
    echo "Could not find VS Code CLI. Install VS Code or add 'code' to PATH." >&2
    return 1
}

vsix="${1-}"
if [ -z "$vsix" ]; then
    # Rebuild contract: bump → package (reinstall always follows below)
    echo "Rebuild: bump version → package → reinstall..."
    cd "$repo_root"
    python3 scripts/bump_extension_version.py || python scripts/bump_extension_version.py
    [ -d node_modules ] || npm install
    npm run package
    vsix=$(ls -t "$repo_root"/*.vsix | head -n1)
fi
[ -f "$vsix" ] || { echo "vsix not found: $vsix" >&2; exit 1; }

code=$(find_code_cli)
# The pre-rename listing registers the same grok.* commands/views, so the two
# cannot coexist — drop it if present (best-effort; absent on fresh machines).
"$code" --uninstall-extension PawelHuryn.grok-vscode-phuryn >/dev/null 2>&1 || true
# Always reinstall (rebuild contract step 3). --force overwrites an existing install.
echo "Reinstalling $vsix via $code"
"$code" --install-extension "$vsix" --force
echo
echo "Done. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') and click the Grok icon."
