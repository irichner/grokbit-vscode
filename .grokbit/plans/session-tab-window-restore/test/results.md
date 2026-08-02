# Results — session-tab-window-restore (verify pass 1)

## Regression vs baseline
| Finding | Class | Citation |
|---|---|---|
| Resume no longer clears `activeSessionId` for whole start | INTENDED | `03-design.md` startSession identity |
| Missing serializer id disposes panel (not new session) | INTENDED | `03-design.md` dispose-orphan |
| `sessionIdentity` re-stashes setState on ready | INTENDED | `03-design.md` Webview re-stash |

Suite: `npm test` — **1439 passed**, 0 failed (vs preflight smoke only; no pre-existing failures recorded).

## Done-criteria coverage
| Criterion | Result |
|---|---|
| Reload Window: history on tabs | UNVERIFIED — manual (unit tests cover identity path only) |
| Full quit/reopen | UNVERIFIED — manual |
| Claude stays Claude | AUTOMATED partial — policy defaults + wire; full E2E manual |
| Grok stays Grok | AUTOMATED partial |
| No duplicate while connecting | AUTOMATED partial — stable id; manual confirm |
| Background tab on focus | AUTOMATED partial — pending spawn; manual confirm |
| Missing disk session clear failure | UNVERIFIED — existing error path unchanged; manual smoke |

## Security
See `security.md` (brief).

## Verdict input
Prefer SHIP WITH CAVEATS until manual Reload Window checklist is done.
