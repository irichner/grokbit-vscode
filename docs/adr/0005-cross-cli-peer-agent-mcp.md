# 0005. Cross-CLI peer agent via loopback HTTP MCP

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Israel Richner (via plan approval + T1 probe)
- **Plan:** `.grokbit/plans/cross-cli-peer-agent/`
- **Probe:** `research/peer-agent-mcp.md`

## Context

Users with both Grok and Claude connected want a **true nested peer**: from a live turn on one CLI, invoke the other and **block** until a result returns — also invocable as a user command from either tab. Disk-only sequential handoff (`.grokbit/plans`) was rejected as the product shape. Shell-sentinel interception of `terminal/create` was rejected as fragile.

ACP lets the client pass `mcpServers` on `session/new` / `session/load`. The extension historically hard-codes `mcpServers: []` (`src/acp.ts`).

## Options

### A — Disk sequential “Continue on other agent”

Seed `/grokbit-*` on another tab. No mid-turn block. **Rejected** by product direction.

### B — Shell sentinel

Intercept a magic shell command and fulfill via peer ACP. Fights real terminals; asymmetric across backends.

### C — Client-injected MCP `run_peer_agent`

Parent agent calls an MCP tool; extension runs the other `AcpClient` and returns text. Matches “true nested” + “command from either tab.”

### C1 — stdio MCP transport

ACP `type:"stdio"` server spawned by the agent.

### C2 — HTTP (loopback) MCP transport

ACP `type:"http"` server on `127.0.0.1` with ephemeral auth header.

## Decision

**Chosen: C + C2 (HTTP loopback MCP).**

T1 probes (`research/peer-mcp-probe.cjs`, 2026-08-22):

- Both Grok and Claude Code ACP advertise `mcpCapabilities: { http: true, sse: true }` only — **no stdio**.
- Both successfully called a hello HTTP MCP `ping` tool in a live `session/prompt` (PASS).
- Therefore stdio (C1) is not viable on current agents.

Further decisions baked into v1:

| Topic | Choice |
|---|---|
| Bridge | MCP HTTP server owned by the extension host (same process or tightly coupled child); tool handler calls `PeerRunner` directly — no extra VS Code command hop required for the tool path |
| Auth | Ephemeral bearer/token in MCP `headers`; bind `127.0.0.1` only; rotate per window/session |
| Depth | Peer sessions omit the peer MCP server → nesting depth 1 by construction |
| Permissions | Route peer `session/request_permission` / questions into the **parent** webview with peer correlation; if that proves unsafe, fall back to a visible peer tab (amendment) |
| Default | `grok.peerAgent.enabled` **off** until UI/cost confirm ships; transport is proven |
| User command | Same `PeerRunner` as the MCP tool |

## Consequences

- **Replace** unconditional `mcpServers: []` with conditional HTTP peer server when enabled + other backend ready.
- **Do not** document or implement stdio peer MCP for these agents.
- Tool ids will differ by backend (`server__tool` vs `mcp__server__tool`) — teach agents via tool description; UI matches on `run_peer_agent` / server name, not a single wire id.
- Claude may prompt permission for MCP tools — parent UI must not deadlock while parent turn awaits the tool.
- Cost doubles when used; user command confirms; tool description warns.
- Suite disk artifacts and User Workflow formats remain unchanged (COEXIST / LEAVE per plan).

## Rejected better-at

- **A** better for zero runtime risk and durable plans.
- **B** better if MCP injection ever regresses.
- **C1** better for zero open port — unavailable given agent capabilities.
