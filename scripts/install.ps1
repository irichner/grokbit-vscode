# Install / rebuild the Grokbit VS Code extension on Windows.
# Usage:  pwsh scripts\install.ps1 [-VsixPath path\to.vsix]
#
# Default (no -VsixPath) = full REBUILD contract (all three, always):
#   1. bump package.json patch  (scripts/bump_extension_version.py)
#   2. package a fresh .vsix    (npm run package; clears stale grokbit-*.vsix)
#   3. reinstall into VS Code   (code --install-extension … --force)
# Never package-only — this script always ends with a reinstall.
# Explicit -VsixPath skips bump/package and only installs that file.
# Tries `code`, then `code-insiders`, then well-known install paths.

param(
    [string]$VsixPath
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

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

if (-not $VsixPath) {
    Write-Host "Rebuild: bump version → package → reinstall..."
    Push-Location $repoRoot
    try {
        # Every rebuild gets a new Marketplace version (package.json patch +1).
        # Independent of the agentic-template VERSION file (commit metrics).
        # Native commands do not throw on non-zero exit under $ErrorActionPreference=Stop.
        python scripts/bump_extension_version.py
        if ($LASTEXITCODE -ne 0) { throw "bump_extension_version failed (exit $LASTEXITCODE)." }
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
}

$code = Find-CodeCli
# The pre-rename listing registers the same grok.* commands/views, so the two
# cannot coexist — drop it if present (best-effort; absent on fresh machines).
try { & $code --uninstall-extension PawelHuryn.grok-vscode-phuryn 2>$null } catch {}
# Always reinstall (rebuild contract step 3). --force overwrites an existing install.
Write-Host "Reinstalling $VsixPath via $code"
& $code --install-extension $VsixPath --force
if ($LASTEXITCODE -ne 0) { throw "VS Code install failed (exit $LASTEXITCODE)." }
Write-Host ""
Write-Host "Done. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') and click the Grok icon."
