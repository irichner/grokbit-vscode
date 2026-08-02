# Security findings — changed-files-dedupe

CRITICAL blocks the release. There is no iteration cap that lets one through.

## CRITICAL
None.

## HIGH
None.

## MEDIUM
None.

## LOW
None.

### Notes (not findings)
- Change is webview-only display aggregation; no new network, auth, fs, or command surfaces.
- Chip still opens via existing host `openFile` message with path from agent-supplied diff (unchanged trust model).
- No secrets in diff.

---

| Severity | Count | Outstanding |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 0 | 0 |
