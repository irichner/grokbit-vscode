# Implement handoff — cross-cli-peer-agent

## Completed
All plan tasks T1–T9 for v1 nested peer agent (HTTP MCP + PeerRunner + command + setting + docs).

## How to use
1. Settings → `grok.peerAgent.enabled` = true  
2. Both backends available (Grok CLI + Claude adapter)  
3. **Grokbit: Run on other agent…** or agent calls MCP `run_peer_agent`

## Residual / known limits
- Peer permissions auto-allowed in v1 (no parent-tab permission cards yet)  
- Default setting remains **off** (cost)  
- User Workflow `.rhai`/`.js` still not cross-CLI  

## Evidence
- `research/peer-agent-mcp.md` — dual-backend HTTP MCP PASS  
- `docs/adr/0005-cross-cli-peer-agent-mcp.md`  
- `npm test` green after implement  

## Commits
none (per repo convention — leave tree for rebuild/release path)
