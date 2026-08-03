# L5 Capabilities / skills

## Reviewed

- `src/capabilities.ts` kind order, roots, name pattern, scan containment
- `src/skill-suite.ts` provision inequality, applySuiteKind ordering notes
- `src/mcp-config.ts` (presence; light)
- `src/slash-filter.ts` (tests exist)

## Findings

### [Major] `Claude.md` Known limits claim workflows are deferred / no `workflow` kind — **stale**

- **Where:** `Claude.md:222` (“Workflows are **deferred**… `CapabilityKind` has no `workflow` member yet”) vs `src/capabilities.ts:43` (`CapabilityKind` includes `"workflow"`) and CAPABILITY_ROOTS workflow entries (`:147-148`).
- **Why:** Docs honesty gate (DC7). Reviewers and agents will skip workflow security if they trust Known limits.
- **Fix:** Rewrite Known limits bullet to match shipped User Workflows discovery + builder (ADR 0004); remove “no workflow member.”

### [Minor] No FS watcher on capability roots

- **Where:** Known limits `:223` — confirmed design.
- **Fix:** None; Refresh button is the mitigation.

## Clean / solid

- Suite re-key-after-scan ordering documented and tested (`skill-suite` + capabilities tests).
- Symlink containment is realpath-based, not Dirent-only.
- `shouldProvision` inequality handles downgrades (`skill-suite.ts:100+`).
