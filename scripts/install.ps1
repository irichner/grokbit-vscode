# Install / rebuild the Grokbit VS Code extension on Windows.
# Usage:  pwsh scripts\install.ps1 [-VsixPath path\to.vsix] [-NoPublish]
#
# Default (no -VsixPath) = full REBUILD contract (all five, always):
#   1. bump package.json CalVer YYYY.M.N  (scripts/bump_extension_version.py)
#   2. package a fresh .vsix    (npm run package; clears stale grokbit-*.vsix)
#   3. reinstall into VS Code   (code --install-extension … --force)
#   4. publish to Marketplace   (npx @vscode/vsce publish --packagePath …)
#   5. commit + push working tree to origin (current branch; message Rebuild vX.Y.Z)
# Never package-only — this script always ends with a reinstall.
# Explicit -VsixPath skips bump/package/publish/commit and only installs that file.
# -NoPublish skips steps 4–5 (local install only; useful without a PAT).
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

function Commit-AndPushRebuild {
    # After a successful Marketplace publish: stage everything, commit if dirty,
    # then push the current branch to origin so source control matches the
    # just-shipped Marketplace build. Mirrors release.ps1's commit/push shape
    # (no tag / no GitHub Release — those stay on scripts/release.*).
    Push-Location $repoRoot
    try {
        $version = (Get-Content (Join-Path $repoRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
        if (-not $version) { throw "Could not read package.json version for commit message." }
        $message = "Rebuild v$version"
        # git often writes progress to stderr; under script-level Stop, PS 5.1
        # can treat that as terminating — judge natives only on exit code.
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $branch = (git rev-parse --abbrev-ref HEAD).Trim()
            if ($LASTEXITCODE -ne 0 -or -not $branch -or $branch -eq "HEAD") {
                throw "Detached HEAD or missing branch - cannot push rebuild commit. Check out a branch first."
            }

            Write-Host "Committing and pushing rebuild to origin/$branch..."
            $dirty = git status --porcelain
            if ($LASTEXITCODE -ne 0) { throw "git status failed (exit $LASTEXITCODE)." }
            if ($dirty) {
                git add -A
                if ($LASTEXITCODE -ne 0) { throw "git add -A failed (exit $LASTEXITCODE)." }
                # Pre-commit may still amend VERSION/token ledger.
                git commit -m $message
                if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)." }
                Write-Host "Committed: $message"
            } else {
                Write-Host "Working tree clean - nothing to commit."
            }

            git push origin $branch
            if ($LASTEXITCODE -ne 0) { throw "git push origin $branch failed (exit $LASTEXITCODE)." }
            Write-Host "Pushed to origin/$branch."
        } finally {
            $ErrorActionPreference = $prevEap
        }
    } finally {
        Pop-Location
    }
}

if (-not $VsixPath) {
    Write-Host "Rebuild: bump version → package → reinstall → publish → commit+push..."
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
    Commit-AndPushRebuild
} elseif ($didFullRebuild -and $NoPublish) {
    Write-Host "Skipping Marketplace publish and git commit+push (-NoPublish)."
}

Write-Host ""
Write-Host "Done. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') and click the Grok icon."
if ($didFullRebuild -and -not $NoPublish) {
    Write-Host "Marketplace: https://marketplace.visualstudio.com/items?itemName=grokbit.grokbit"
    Write-Host "Source control: working tree committed and pushed to origin."
}
