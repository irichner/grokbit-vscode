# L1 Trust / security

## Reviewed

- `src/plan-gate.ts` (full policy surface)
- `src/permission-bind.ts` (full)
- `src/terminal-manager.ts` (create/kill/exit)
- `src/env-filter.ts` (full)
- `src/capabilities.ts` containment (`isPathContained`, scan loop ~650–830)
- `src/voice.ts` key resolution
- `src/telemetry.ts` builders + `postEvent`
- Integration: `src/acp.ts:638-682` plan gate + grant consume

## Findings

### [Major] Workspace `.env` may still set `XAI_API_KEY` / grok secret names

- **Where:** `src/env-filter.ts:27-43` denies `ANTHROPIC_*`, `CLAUDE_*`, proxies, `NODE_OPTIONS`, `PATH` only.
- **Why:** Comment correctly frames workspace `.env` as attacker-controlled on clone+trust. Grok billing/auth secrets (`XAI_API_KEY`, `GROK_CODE_XAI_API_KEY`, `GROK_VOICE_API_KEY`) are **not** filtered, so a malicious repo can force the spawned agent onto attacker credentials or unexpected key material via merge-over `process.env` (see module comment `:5-14`).
- **Fix:** Extend `DENIED_DOT_ENV_EXACT` / prefixes to cover `XAI_*`, `GROK_*` credential names (mirror `XAI_SECRET_ENV_VARS` in `claude-locator.ts:314`), with unit tests like existing env-filter cases.

### [Major] Markdown links allow `javascript:` (and similar) URLs into `href`

- **Where:** `media/chat.js:2025-2027` (also file-ref links `:2019-2021`).
- **Why:** After HTML entity escape, `[x](javascript:…)` still becomes `<a href="javascript:…">`. Webview CSP may block some schemes, but scheme allowlisting is the durable fix; agent/untrusted transcript content should not drive active schemes.
- **Fix:** Allow only `http:`, `https:`, `vscode:`, relative file refs already handled separately; drop or neutralize other schemes. Add a unit/DOM test.

### [Minor] Permission bind fail-open with zero path/command grants

- **Where:** `src/permission-bind.ts:10-18`, `consumeWriteGrant:182`.
- **Why:** Documented product semantics (Agent mode may write without a prior card). Not a bug if Agent is intended; risk is user confusion vs Auto-accept. Already disclosed in Known limits (`Claude.md:219`).
- **Fix:** None required for security model; optional UX copy clarifying “no grant = agent may still write in Agent mode.”

### [Minor] Terminal uses `shell: true` with agent-supplied command string

- **Where:** `src/terminal-manager.ts:81`.
- **Why:** Required ACP shape; mitigation is plan-gate allowlist + permission bind when grants exist. Residual risk is intentional thin-client shell.
- **Fix:** Keep; ensure plan-mode + grant tests stay green (they are).

## Clean / solid

- Plan-gate metacharacter + pipeline stage allowlist is conservative (`plan-gate.ts:91-233`).
- Plan write snoop + workspace containment integrated in `acp.ts` before write.
- Capability symlink realpath containment + name pattern (`capabilities.ts:212`, `:719+`).
- Telemetry props content-free (`telemetry.ts:93-98`); dual global+setting gate.
- Content digest on allow-once Write previews (`permission-bind.ts:141-144`, `:190-194`).
