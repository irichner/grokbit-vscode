# Peer agent via client-injected MCP — probe results

**Plan:** `.grokbit/plans/cross-cli-peer-agent/` · **Probe:** `research/peer-mcp-probe.cjs`  
**Date:** 2026-08-22 (machine: Richbee-Laptop)

## Verdict

| Backend | Transport | `session/new` with mcpServers | Model called hello `ping` | Status |
|---|---|---|---|---|
| Grok (`grok agent stdio`) | **HTTP** | OK | Yes (`grokbit-hello__ping` via `use_tool`) | **PASS** |
| Claude (`claude-code-acp`) | **HTTP** | OK | Yes (`mcp__grokbit-hello__ping`) | **PASS** |
| Grok | stdio | (not required) | — | **UNSUPPORTED** — `mcpCapabilities` has no `stdio` |

## Capabilities (initialize)

Both agents advertise:

```json
"mcpCapabilities": { "http": true, "sse": true }
```

No `stdio` key. Per ACP session-setup, the client must not inject `type:"stdio"` MCP servers against these agents. **v1 peer feature must use HTTP (loopback) MCP**, not stdio.

## Tool naming observed

| Backend | Wire tool id |
|---|---|
| Grok | `grokbit-hello__ping` (MCP server name + `__` + tool; invoked through Grok's `use_tool` / `search_tool` path) |
| Claude | `mcp__grokbit-hello__ping` (Claude Code MCP prefix); permission card fired once |

## Commands run

```bash
node research/peer-mcp-probe.cjs --no-prompt   # session/new only — both OK
node research/peer-mcp-probe.cjs --grok        # full turn — PASS
node research/peer-mcp-probe.cjs --claude      # full turn — PASS
```

Hello servers: `research/fixtures/hello-mcp-http-server.cjs` (and stdio fixture kept for negative tests).

## Implications for implementation

1. **ADR / T4–T5:** Host an **HTTP** MCP on `127.0.0.1` with ephemeral auth token in headers; pass `{ type:"http", name:"grokbit-peer", url, headers }` in `session/new` / `session/load`.
2. **Do not** rely on stdio MCP for Grok or current Claude adapter.
3. Setting remains **default off** until product UX (permissions, cost) lands — probes prove transport, not product readiness.
4. Unrelated noise: Grok stderr may log AuthRequired for *other* configured MCP servers (e.g. RunPod); ignore for this gate.
5. Claude peer tools may require `session/request_permission` — parent UI must answer those while nested.

## Open

- Exact Streamable-HTTP vs simple POST compatibility across future CLI versions (hello server is minimal JSON-RPC POST; both agents accepted it for `ping`).
- SSE transport not probed (http was enough for PASS).
