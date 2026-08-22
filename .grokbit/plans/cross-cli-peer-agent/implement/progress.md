# Progress — cross-cli-peer-agent

| Task | Status | Attempts | Notes |
|---|---|---|---|
| T1 | done | 1 | HTTP MCP PASS on Grok + Claude; stdio unsupported. `research/peer-agent-mcp.md` |
| T2 | done | 1 | `docs/adr/0005-cross-cli-peer-agent-mcp.md` |
| T3 | done | 1 | `src/peer-agent.ts` + 16 tests |
| T4 | done | 1 | MCP HTTP server + PeerRunner; wired in sidebar |
| T5 | done | 1 | `AcpClient` accepts `mcpServers`; parents inject when setting on |
| T6 | done | 1 | v1: auto-allow peer permissions; command surfaces result on parent tab. Full nested permission UI deferred (documented Known limit) |
| T7 | done | 1 | `grok.runPeerAgent` command |
| T8 | done | 1 | Setting + CLAUDE.md / workflows / skills README |
| T9 | done | 1 | `npm test` 1779 passed (85 files) |

Status: all tasks `done` (with T6 honesty: auto-allow, not parent-routed cards).  
Re-approved after how-it-works description — no further implement work required for v1.
