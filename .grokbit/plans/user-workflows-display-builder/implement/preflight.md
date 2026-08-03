# Preflight — user-workflows-display-builder

| Check | Expected | Observed | Status |
|---|---|---|---|
| Git | installed, repo, user.name/email | git ok; Israel Richner / israel.richner@gamil.com | PASS |
| Dirty-tree snapshot | only if dirty | tree clean except untracked plan dir at start; **no stash** (nothing to protect). Project rule: do not auto-commit | PASS — snapshot: none |
| Runtime | Node for vitest | v22.20.0, npm 10.9.3 | PASS |
| Deps | lockfile / node_modules | npm test runnable | PASS |
| Env vars | none required for unit suite | n/a | PASS |
| Ports | n/a | n/a | PASS |
| Services | none | n/a | PASS |
| Clean suite | green | targeted 250 green pre-change; full suite after: 1516 green | PASS |

## Pre-existing test failures

None observed.

Suite state at start (targeted): 250 passed (webview-helpers + capabilities.dom).

## Blocked

None.

## Project overrides

- **No per-task git commit** — `CLAUDE.md` / repo convention: never commit automatically; user must request commits. Recorded as non-counting deviation.
- Plan approval ticked from `/grokbit-implement this plan` (2026-08-02).
- Canvas: ADR author chooses **vanilla** (defaults).
- Craft: **seed-only**. Claude: **grok-only builder**.
