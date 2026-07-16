#!/usr/bin/env node
// Cross-platform entry for the full local rebuild:
//   bump package.json patch → package .vsix → reinstall into VS Code
// Invoked as: npm run rebuild
// Delegates to scripts/install.ps1 (Windows) or scripts/install.sh (elsewhere).
// Optional args are forwarded (e.g. a vsix path on Unix; use install.ps1 -VsixPath on Windows).

"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const extra = process.argv.slice(2);

let cmd;
let args;

if (isWin) {
  // Prefer PowerShell 7; fall back to Windows PowerShell.
  const ps1 = path.join(repoRoot, "scripts", "install.ps1");
  cmd = "pwsh";
  args = ["-NoProfile", "-File", ps1, ...extra];
  let r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", shell: false });
  if (r.error && r.error.code === "ENOENT") {
    cmd = "powershell";
    args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, ...extra];
    r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", shell: false });
  }
  if (r.error) {
    console.error(`Failed to run ${cmd}: ${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status === null ? 1 : r.status);
}

const sh = path.join(repoRoot, "scripts", "install.sh");
cmd = "bash";
args = [sh, ...extra];
const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", shell: false });
if (r.error) {
  console.error(`Failed to run ${cmd} ${sh}: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
