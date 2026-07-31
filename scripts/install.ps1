# Install / rebuild the Grokbit VS Code extension on Windows.
# Usage:  pwsh scripts\install.ps1 [-VsixPath path\to.vsix] [-NoPublish]
#
# Default (no -VsixPath) = full REBUILD contract (all four, always):
#   1. bump package.json CalVer YYYY.M.N  (scripts/bump_extension_version.py)
#   2. package a fresh .vsix    (npm run package; clears stale grokbit-*.vsix)
#   3. reinstall into VS Code   (code --install-extension … --force)
#   4. publish to Marketplace   (npx @vscode/vsce publish --packagePath …)
# Never package-only — this script always ends with a reinstall.
# Explicit -VsixPath skips bump/package/publish and only installs that file.
# -NoPublish skips step 4 (local install only; useful without a PAT).
# Tries `code`, then `code-insiders`, then well-known install paths.
#
# Marketplace auth: set VSCE_PAT (Azure DevOps PAT with Marketplace → Manage),
# or run `npx @vscode/vsce login Grokbit` once. Without auth, step 4 fails.

param(
    [string]$VsixPath,
    [switch]$NoPublish
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$didFullRebuild = $false

function Find-CodeCli {
    foreach ($name in @("code", "code-insiders")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $fallback = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd"
    if (Test-Path $fallback) { return $fallback }
    $fallback = "$env:LOCALAPPDATA\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd"
    if (Test-Path $fallback) { return $fallback }
    throw "Could not find VS Code CLI. Install VS Code or add 'code' to PATH."
}

function Publish-MarketplaceVsix {
    param([Parameter(Mandatory = $true)][string]$PackagePath)

    if (-not (Test-Path $PackagePath)) {
        throw "Cannot publish: vsix not found at $PackagePath"
    }

    Write-Host "Publishing to VS Code Marketplace: $PackagePath"
    Push-Location $repoRoot
    try {
        # Prefer VSCE_PAT so non-interactive /rebuild works in agent shells.
        # Fall back to stored `vsce login` credentials when the env var is unset.
        # Quote @vscode/vsce — bare @ is PowerShell splat syntax.
        if ($env:VSCE_PAT) {
            npx --yes "@vscode/vsce" publish --packagePath $PackagePath --pat $env:VSCE_PAT
        } else {
            npx --yes "@vscode/vsce" publish --packagePath $PackagePath
        }
        if ($LASTEXITCODE -ne 0) {
            throw @"
Marketplace publish failed (exit $LASTEXITCODE).
Auth: set VSCE_PAT to an Azure DevOps PAT with Marketplace → Manage scope,
  or run: npx "@vscode/vsce" login Grokbit
Local-only rebuild: npm run rebuild -- -NoPublish
"@
        }
    } finally {
        Pop-Location
    }
    Write-Host "Marketplace publish succeeded."
}

if (-not $VsixPath) {
    Write-Host "Rebuild: bump version → package → reinstall → publish..."
    Push-Location $repoRoot
    try {
        # Every rebuild gets a new Marketplace version (CalVer YYYY.M.N).
        # Independent of the agentic-template VERSION file (commit metrics).
        # Native commands do not throw on non-zero exit under $ErrorActionPreference=Stop.
        python scripts/bump_extension_version.py
        if ($LASTEXITCODE -ne 0) { throw "bump_extension_version failed (exit $LASTEXITCODE)." }
        # Refresh the development-token ledger BEFORE packaging, so the vsix
        # carries a constant no older than the build shipping it. Deliberately
        # NON-FATAL: no Python, no transcripts, or an aggregator error must
        # never be able to block a rebuild or a release — the committed
        # constant just stays as it is.
        Write-Host "Refreshing development-token ledger (non-fatal)..."
        try {
            python scripts/aggregate_token_usage.py --write
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Token metrics refresh failed (exit $LASTEXITCODE); shipping the committed constant."
            }
        } catch {
            Write-Warning "Token metrics refresh skipped: $($_.Exception.Message)"
        }
        if (-not (Test-Path "node_modules")) {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)." }
        }
        npm run package   # clears stale *.vsix first, then builds
        if ($LASTEXITCODE -ne 0) { throw "npm run package failed (exit $LASTEXITCODE)." }
        $vsix = Get-ChildItem -Path $repoRoot -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    } finally { Pop-Location }
    if (-not $vsix) { throw "Build did not produce a .vsix." }
    $VsixPath = $vsix.FullName
    $didFullRebuild = $true
}

$code = Find-CodeCli
# The pre-rename listing registers the same grok.* commands/views, so the two
# cannot coexist — drop it if present (best-effort; absent on fresh machines).
try { & $code --uninstall-extension PawelHuryn.grok-vscode-phuryn 2>$null } catch {}
# Always reinstall (rebuild contract step 3). --force overwrites an existing install.
Write-Host "Reinstalling $VsixPath via $code"
& $code --install-extension $VsixPath --force
if ($LASTEXITCODE -ne 0) { throw "VS Code install failed (exit $LASTEXITCODE)." }

if ($didFullRebuild -and -not $NoPublish) {
    Publish-MarketplaceVsix -PackagePath $VsixPath
} elseif ($didFullRebuild -and $NoPublish) {
    Write-Host "Skipping Marketplace publish (-NoPublish)."
}

Write-Host ""
Write-Host "Done. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') and click the Grok icon."
if ($didFullRebuild -and -not $NoPublish) {
    Write-Host "Marketplace: https://marketplace.visualstudio.com/items?itemName=grokbit.grokbit"
}
