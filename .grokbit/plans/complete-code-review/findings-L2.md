# L2 ACP + backends

## Reviewed

- `src/backends.ts` quirks model (full)
- `src/cli-locator.ts` pin constants + pure broken-range helpers
- `src/claude-locator.ts` env strip / XAI secrets / adapter notes
- `src/acp.ts` server request handlers (fs/terminal/permission region ~620–700); full file 778 lines — **sampled** remaining lifecycle
- `src/acp-dispatch.ts` — sampled via test map (69 tests)

## Sampling (DC9)

- **Deep:** backends quirks, write/terminal gate block in acp, cli pin constants, claude env strip.
- **Sampled:** full session/new/load prompt streaming paths in acp (covered heavily by `acp-integration` + unit tests).

## Findings

### [Minor] Windows pin target may lag newest stable grok

- **Where:** `GROK_STDIO_DOWNGRADE_TARGET = "0.2.72"` `cli-locator.ts:56`.
- **Why:** Product docs say bump when newer Windows-verified builds ship. Stale pin is maintenance risk, not a correctness bug if 0.2.72 still works.
- **Fix:** Periodic verify with session/new probe; bump constant when validated.

### [Nit] backends.ts comments dense but accurate

- Dual `clientPlanGate` true for Claude + `clientPlanPermissionReject` false is coherent (`backends.ts:47-72`).

## Clean / solid

- Quirks table is the right structural gate (no scattered backend ifs as primary control).
- Claude spawn strips `CLAUDECODE`, optional API key, and **always** strips XAI secrets from Claude child (`claude-locator.ts:331-366`).
- Fake-CLI ACP integration suite exercises plan snoop + effort args (18 tests green).
