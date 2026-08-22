# Security review — plan-gate widen

**Verdict (after `\\.\` fix):** Pass for merge of the T1/T2 change, with the High prefix bypass closed.

Late-arriving auditor (`01a0279e-122d`) found:

1. **High — `\\.\` / `//./` skipped `canonical`.** Closed: `WIN_DEVICE_PREFIX` strips `\\?\` and `\\.\` (and slash forms). Tests in `test/plan-gate.test.ts`.
2. **Medium — `(` subexpressions.** Pre-existing; spawn is `cmd.exe`/`/bin/sh`, not PowerShell. Not widened in this PR (`(` would also break `find \( -name … \)`). Residual noted.
3. **Low — PATH-resolved `Write-Output`.** Same class as existing `Get-ChildItem` / `git`. Residual noted.
