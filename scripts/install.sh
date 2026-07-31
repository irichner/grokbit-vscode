#!/usr/bin/env bash
# Install / rebuild the Grokbit VS Code extension on macOS / Linux / WSL.
# Usage:  ./scripts/install.sh [path/to/file.vsix] [--no-publish]
#
# Default (no vsix argument) = full REBUILD contract (all four, always):
#   1. bump package.json CalVer YYYY.M.N  (scripts/bump_extension_version.py)
#   2. package a fresh .vsix    (npm run package; clears stale grokbit-*.vsix)
#   3. reinstall into VS Code   (code --install-extension … --force)
#   4. publish to Marketplace   (npx @vscode/vsce publish --packagePath …)
# Never package-only — this script always ends with a reinstall.
# Explicit vsix path skips bump/package/publish and only installs that file.
# --no-publish skips step 4 (local install only; useful without a PAT).
#
# Marketplace auth: set VSCE_PAT (Azure DevOps PAT with Marketplace → Manage),
# or run `npx @vscode/vsce login Grokbit` once. Without auth, step 4 fails.

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

publish_marketplace_vsix() {
    local package_path="$1"
    if [ ! -f "$package_path" ]; then
        echo "Cannot publish: vsix not found at $package_path" >&2
        exit 1
    fi
    echo "Publishing to VS Code Marketplace: $package_path"
    cd "$repo_root"
    # Prefer VSCE_PAT so non-interactive /rebuild works in agent shells.
    # Fall back to stored `vsce login` credentials when the env var is unset.
    if [ -n "${VSCE_PAT-}" ]; then
        npx --yes @vscode/vsce publish --packagePath "$package_path" --pat "$VSCE_PAT"
    else
        npx --yes @vscode/vsce publish --packagePath "$package_path"
    fi
    echo "Marketplace publish succeeded."
}

vsix=""
no_publish=0
for arg in "$@"; do
    case "$arg" in
        --no-publish|-NoPublish)
            no_publish=1
            ;;
        -*)
            echo "Unknown option: $arg (supported: --no-publish)" >&2
            exit 1
            ;;
        *)
            if [ -n "$vsix" ]; then
                echo "Unexpected extra argument: $arg" >&2
                exit 1
            fi
            vsix="$arg"
            ;;
    esac
done

did_full_rebuild=0
if [ -z "$vsix" ]; then
    # Rebuild contract: bump → package → reinstall → publish
    echo "Rebuild: bump version → package → reinstall → publish..."
    cd "$repo_root"
    python3 scripts/bump_extension_version.py || python scripts/bump_extension_version.py
    # Refresh the development-token ledger BEFORE packaging, so the vsix carries
    # a constant no older than the build shipping it. Deliberately NON-FATAL
    # (note the trailing `|| true` under `set -e`): no Python, no transcripts, or
    # an aggregator error must never be able to block a rebuild or a release —
    # the committed constant just stays as it is.
    echo "Refreshing development-token ledger (non-fatal)..."
    (python3 scripts/aggregate_token_usage.py --write \
        || python scripts/aggregate_token_usage.py --write \
        || echo "Token metrics refresh skipped; shipping the committed constant." >&2) || true
    [ -d node_modules ] || npm install
    npm run package
    vsix=$(ls -t "$repo_root"/*.vsix | head -n1)
    did_full_rebuild=1
fi
[ -f "$vsix" ] || { echo "vsix not found: $vsix" >&2; exit 1; }

code=$(find_code_cli)
# The pre-rename listing registers the same grok.* commands/views, so the two
# cannot coexist — drop it if present (best-effort; absent on fresh machines).
"$code" --uninstall-extension PawelHuryn.grok-vscode-phuryn >/dev/null 2>&1 || true
# Always reinstall (rebuild contract step 3). --force overwrites an existing install.
echo "Reinstalling $vsix via $code"
"$code" --install-extension "$vsix" --force

if [ "$did_full_rebuild" -eq 1 ] && [ "$no_publish" -eq 0 ]; then
    publish_marketplace_vsix "$vsix" || {
        echo "Marketplace publish failed." >&2
        echo "Auth: set VSCE_PAT to an Azure DevOps PAT with Marketplace → Manage scope," >&2
        echo "  or run: npx @vscode/vsce login Grokbit" >&2
        echo "Local-only rebuild: npm run rebuild -- --no-publish" >&2
        exit 1
    }
elif [ "$did_full_rebuild" -eq 1 ] && [ "$no_publish" -eq 1 ]; then
    echo "Skipping Marketplace publish (--no-publish)."
fi

echo
echo "Done. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') and click the Grok icon."
if [ "$did_full_rebuild" -eq 1 ] && [ "$no_publish" -eq 0 ]; then
    echo "Marketplace: https://marketplace.visualstudio.com/items?itemName=grokbit.grokbit"
fi
