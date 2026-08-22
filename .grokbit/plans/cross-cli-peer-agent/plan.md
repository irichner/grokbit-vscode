# Plan — Cross-CLI nested peer agent (extension MCP)

**Slug (durable):** `cross-cli-peer-agent`  
**Prior plan rejected:** disk-only “Continue on other agent” sequential handoff — superseded by this redesign.  
**Host Plan Mode note:** after approval, copy into `.grokbit/plans/cross-cli-peer-agent/` before suite implement.

**Approach:** Extension-injected **HTTP** (loopback) MCP tool `run_peer_agent` on `session/new`/`load` so a live Grok or Claude turn can block on the **other** CLI; same path exposed as a user command from either tab.  
**Blast radius:** high — new MCP bridge + `AcpClient` session wiring + nested UI + setting/docs; **0** npm deps (Node `http` MCP in-repo); **no** DB schema. Requires an **ADR**.  
**T1 gate (2026-08-22):** Both backends **PASS** on HTTP MCP hello `ping`; both advertise `mcpCapabilities: {http,sse}` only — **stdio unsupported**. See `research/peer-agent-mcp.md`.

---

## 1. Intent

### Problem
Users with **both** Grok and Claude connected want a workflow step that **passes work to the other CLI mid-turn** — a true nested peer, not “open another tab and paste,” and not “hope `.grokbit/plans` is enough.” Today `mcpServers: []` is hard-coded (`src/acp.ts:295`, `:317`), same-backend subagents are research-only / not `spawn_subagent` on wire (`research/subagents.md`), and User Workflow formats are not interchangeable.

### Done criteria
- [ ] From a **Grok** tab, the agent (or user) can invoke a peer run that executes on **Claude**; the parent turn **waits** for the peer result (nested tool semantics), then continues with that result in context.
- [ ] From a **Claude** tab, the same works toward **Grok** (symmetric).
- [ ] While the peer runs, the **parent tab** shows a distinct nested **Peer: Claude/Grok** activity (not a silent background shell), and permissions/questions from the peer are answerable without deadlocking the UI.
- [ ] A **user-invokable command** exists on either tab (palette and/or slash/composer seed) that starts the same peer path with a prompt the user supplies.
- [ ] Peer nesting depth is capped at **1** (peer cannot call `run_peer_agent` again); over-cap returns a clear tool error.
- [ ] If the other backend is unavailable (missing CLI/adapter/auth), the tool/command fails with an honest error — no hang.
- [ ] Automated: pure unit tests for policy/envelope/depth; fake-CLI or mocked bridge tests for host path; `npm test` green. Live probe (optional / `research/` or `test:live` flag) documents whether both agents honor client `mcpServers` — if not, feature stays behind a setting default off with documented limit.
- [ ] ADR records why MCP-injected peer was chosen over shell-sentinel / disk-only handoff.

### Non-goals
- Transpiling Grok `.rhai` ↔ Claude `.js` User Workflows.
- Shared ACP `session/load` across backend stores.
- Unlimited nested peers / peer-of-peer graphs.
- Replacing suite disk artifacts (`.grokbit/plans`) — they remain the durable plan/implement contract; this feature is **live delegation**, not plan persistence.
- Full nested inspector for grok’s native same-CLI background subagents (still deferred per `research/subagents.md`).
- Auto-routing whole `/grokbit-ship` pipelines across backends without an explicit peer call.

### Constraints
- Thin client where possible: orchestration in extension host; agents call one MCP tool.
- Must not break existing dual-backend tabs, `switchBackend` chat handoff, plan gate, soft `MAX_LIVE_SESSIONS` (8).
- Peer session counts toward live process budget; refuse peer spawn when at cap with a clear error.
- No new Marketplace secrets; peer uses the user’s existing CLI auth.
- Windows + macOS/Linux; stdio MCP command must be a resolvable Node/`process.execPath` script shipped with the extension.

### Assumptions
- `UNVERIFIED` Both Grok and `@zed-industries/claude-code-acp` connect to client-supplied `mcpServers` stdio entries and expose tools to the model. **Gate:** research probe before enabling default-on.
- `UNVERIFIED` Parent `session/prompt` remains open while the agent awaits an MCP tool result (standard tool-loop); peer is a **separate** `AcpClient`, not a second prompt on the parent session.
- `UNVERIFIED` Peer permissions can be fulfilled on the parent tab’s UI (correlated by peer session id) without requiring a second visible editor tab (v1 may open a disposable side session tab if correlation is too hard — call out at gate if probe forces it).
- Setting `grok.peerAgent.enabled` defaults **`off`** until probes pass on both backends; then consider `auto` when both connected.

### Questions asked (this revision)
1. Orchestrator? → **Extension host**
2. Pass-work meaning? → **True nested subagent**
3. v1 demo? → **Single command from either tab**
4. Invoke mechanism? → **Extension-injected MCP tool**
5. (Prior rejection) Not disk Continue-button sequential handoff.

---

## 2. Survey (ground truth)

| Entity | Status | Citation |
|---|---|---|
| `mcpServers: []` on new/load | Exists (empty) | `src/acp.ts:293-296`, `:314-317` |
| ACP allows client MCP on session/new | Protocol yes | agentclientprotocol.com session-setup — stdio `{type,name,command,args,env}` |
| Extension MCP config UX | Count-only / open terminal | `src/mcp-config.ts`; `sidebar.ts` MCP list terminal ~3142 |
| Extension-hosted MCP server for tools | **DOES NOT EXIST** | no peer MCP under `resources/` |
| Dual backend sessions / `AcpClient` | Exists | `src/sidebar.ts` `startSession` / `newTab(backend)` |
| Cross-backend **chat** handoff | Exists | `src/agent-handoff.ts`; `switchBackend` `sidebar.ts:648+` |
| Same-CLI subagent over ACP | Deferred | `research/subagents.md`; classifier `media/webview-helpers.js:142-164` |
| User Workflows cross-format | Explicitly not interchangeable | `src/capabilities.ts:154-174`; CLAUDE.md Known limits |
| Soft live session cap | Exists | `MAX_LIVE_SESSIONS = 8` `sidebar.ts:306` |
| Suite disk cross-host claim | Docs only | `resources/skills/README.md:174` |

### Reusable
- `locateGrokCli` / `locateClaudeAdapter` + `buildClaudeAdapterArgv/Env`
- `AcpClient` prompt lifecycle + event emit into `PanelRouter`
- Subagent **card UI** patterns (`isSubagentToolCall` / `addSubagentCard`) — extend or twin for **peer** cards (different label: Peer: Claude)
- `agent-handoff` envelope ideas for peer brief — optional; peer prompt is explicit tool arg

### Supersession
| Item | Notes |
|---|---|
| Rejected Continue-on-other-agent plan | Do not implement; this plan replaces it |
| Empty `mcpServers` | **REPLACE** with optional peer server entry when enabled |
| Docs “plan in Grok, implement in Claude” | **COEXIST** — still true for disk suite; add peer-agent section for live nesting |

### Absences / danger zones
- No probe proving mcpServers work on both agents in this repo
- Nested permission + `promptInFlight` complexity in `sidebar.ts`
- MCP child process lifecycle / crash / Windows path quoting
- Re-entrancy and cost (two subscriptions burning tokens)

---

## 3. Design

### Option A — Disk sequential Continue button (rejected)
Human flips/opens other tab; seed `/grokbit-*`. No mid-turn block. **Rejected by user.**

### Option B — Shell sentinel via `terminal/create` intercept
Magic command rewritten to peer ACP. Fragile; fights real shell tools; hard for Claude parity.

### Option C — Extension-injected MCP `run_peer_agent` (Recommended)
On `session/new`/`load`, when peer feature enabled and other backend ready, pass one **HTTP** MCP server on loopback. Tool blocks parent agent tool-loop; MCP handler runs peer `AcpClient.prompt` in the extension host; returns final text. User command wraps the same host API.

### Decision
**Option C with HTTP transport** (T1 proved stdio unsupported on both agents). Ship behind `grok.peerAgent.enabled` (default off until product UX ready; transport gate is green).

### Architecture (v1)

```
Parent tab (Grok or Claude)
  session/prompt … agent calls MCP tool run_peer_agent({ prompt, … })
       │
       ▼
HTTP MCP server (127.0.0.1, ephemeral token header) — extension-owned
       │  in-process or same-host call into PeerRunner
       ▼
Extension host PeerRunner
  - resolve other BackendId
  - spawn/reuse headless AcpClient (omit peer MCP → depth 1)
  - forward permissions/questions to parent webview as peer-* cards
  - collect assistant text (bounded)
  - return to MCP tool result
       │
       ▼
Parent agent continues turn with tool result
```

**User command:** `grok.runPeerAgent` + composer/slash “Run on Claude/Grok…” → calls `PeerRunner` directly (same code), then injects result into the **current** session as a user/tool-visible message (or starts a short follow-up prompt). Prefer: show peer card + append a system-visible result bubble the user can Ask to continue with.

### ADR topics (mandatory task)
- MCP stdio vs HTTP transport (agent capabilities `session.mcp.stdio`)
- Bridge auth (ephemeral token; never world-open port)
- Headless peer vs visible tab for permissions
- Depth cap, timeouts, token/cost disclosure
- Why not shell sentinel / disk-only

### Disposition
| Item | Disposition | Reason |
|---|---|---|
| Hard-coded `mcpServers: []` | REPLACE | Inject peer server when enabled |
| Rejected Continue-button plan | LEAVE | Not built |
| `agent-switch-retain-context` | LEAVE | Chat flip ≠ nested peer |
| Suite `.grokbit/plans` portability | COEXIST | Durable phases still disk-based |
| User Workflow cross-format bridge | LEAVE | Non-goal |
| Native same-CLI subagent inspector | LEAVE | Still deferred |

### Unhappy paths
- Other backend missing → tool error string, no hang
- Peer auth required → error with “Sign in to Claude/Grok” guidance
- Peer permission denied by user → tool result reports cancelled
- Timeout → cancel peer client, error result
- At `MAX_LIVE_SESSIONS` → refuse peer spawn
- Peer tries `run_peer_agent` → MCP server not registered on peer sessions (depth 1 by construction)

---

## 4. Review (adversarial)

- [BLOCKER-risk] **mcpServers ignored by one/both agents** → feature cannot work. **Mitigation:** T1 probe gate; default setting off; document; do not advertise until probe PASS.
- [MAJOR] **Permission deadlock** — parent waiting on MCP while peer needs `request_permission` with nowhere to render. **Mitigation:** route peer permissions into parent webview with peer correlation; or fall back to visible peer tab (ADR pick).
- [MAJOR] **Security** — loopback MCP bridge must not allow arbitrary local process control without token; tool must not accept `command` to run arbitrary shells on peer beyond normal agent tools. **Mitigation:** peer only runs normal ACP agent; bridge auth; no shell passthrough API.
- [MAJOR] **Cost/UX surprise** — nested run doubles spend. **Mitigation:** confirm on user-command; tool description warns; optional setting.
- [MINOR] Card classifier may misfire peer as background subagent — use dedicated message type / tool name `run_peer_agent`.

Round-1: no unresolved BLOCKER if T1 is a hard gate before default-on.

---

## 5. Tasks

### T1 — Dual-backend `mcpServers` probe (gate)
- **intent:** Prove or falsify that Grok and Claude ACP honor a client-supplied stdio MCP server and that the model can call a hello-world tool.
- **files:** `research/peer-mcp-probe.cjs` (new), short note under `research/peer-agent-mcp.md` (new)
- **cwd:** none
- **depends:** none
- **verify:** manual `node research/peer-mcp-probe.cjs` documents PASS/FAIL per backend in `research/peer-agent-mcp.md` (not in `npm test`; CI stays grok-free)
- **removes:** none
- **baseline:** none
- **rollback:** delete research files
- **state-after:** working
- **notes:** If FAIL on a backend, later tasks keep feature off for that backend; plan assumes at least one direction may ship first.

### T2 — ADR 0005 Peer agent via injected MCP
- **intent:** Record decision C, bridge design, permission UX, depth/timeout caps, default-off setting.
- **files:** `docs/adr/0005-cross-cli-peer-agent-mcp.md` (new)
- **cwd:** none
- **depends:** T1
- **verify:** file exists and states Chosen option + consequences; linked from plan notes
- **removes:** none
- **baseline:** none
- **rollback:** delete ADR
- **state-after:** working
- **notes:** Follow `docs/adr/0004-workflow-builder-canvas.md` shape.

### T3 — Pure peer policy module + tests
- **intent:** Depth cap, timeout defaults, brief envelope, backend flip map (`grok`→`claude`), readiness error strings — no vscode.
- **files:** `src/peer-agent.ts` (new), `test/peer-agent.test.ts` (new)
- **cwd:** none
- **depends:** T2
- **verify:** `npm test -- test/peer-agent.test.ts`
- **removes:** none
- **baseline:** none
- **rollback:** delete both files
- **state-after:** working
- **notes:** Keep separate from `agent-handoff.ts` (different job).

### T4 — MCP server binary + host bridge
- **intent:** Ship stdio MCP server script that exposes `run_peer_agent` and calls the extension bridge; host implements PeerRunner spawn of other `AcpClient`.
- **files:** e.g. `resources/mcp/grokbit-peer/server.cjs` (or `.mjs`), bridge code in `src/peer-agent-host.ts` (new), wire from `src/sidebar.ts` / `src/extension.ts`
- **cwd:** none
- **depends:** T3
- **verify:** unit tests with fake bridge; `npm test -- test/peer-agent.test.ts test/peer-agent-host.test.ts` (new host test as needed)
- **removes:** none
- **baseline:** `mcpServers: []` always
- **rollback:** revert new files + sidebar/extension wiring
- **state-after:** working
- **notes:** Peer sessions must **omit** the peer MCP server (depth 1). Respect `MAX_LIVE_SESSIONS`.

### T5 — Inject mcpServers from AcpClient when enabled
- **intent:** `newSession`/`loadSession` pass peer MCP config when setting on + other backend ready; still `[]` when off.
- **files:** `src/acp.ts`, callers supplying MCP list from sidebar
- **cwd:** none
- **depends:** T4
- **verify:** `npm test` targeted acp/fake-cli tests updated; assert empty when disabled
- **removes:** unconditional empty-only behavior when feature on
- **baseline:** always-empty mcpServers
- **rollback:** `git checkout -- src/acp.ts` (+ callers)
- **state-after:** working
- **notes:** Check initialize capabilities for mcp stdio when available; degrade honestly.

### T6 — Nested peer UI + permission routing
- **intent:** Parent tab renders Peer card / activity for child tool calls; peer permissions/questions solvable on parent (or documented visible-tab fallback per ADR).
- **files:** `media/chat.js`, `media/chat.css`, `media/webview-helpers.js`, `src/sidebar.ts`, DOM tests
- **cwd:** none
- **depends:** T5
- **verify:** `npm test --` relevant `test/*.dom.test.ts` + peer tests
- **removes:** none
- **baseline:** only same-CLI subagent card scaffolding
- **rollback:** checkout media + sidebar pieces
- **state-after:** working
- **notes:** Do not classify as grok background `[bg]` subagent; dedicated types.

### T7 — User command from either tab
- **intent:** Palette `Grokbit: Run on other agent…` (and optional slash/composer entry) collects prompt, runs PeerRunner, shows result on current tab.
- **files:** `package.json` contributes, `src/extension.ts` / `sidebar.ts`, webview optional
- **cwd:** none
- **depends:** T4
- **verify:** message-contract / command registration test or source assertion; manual smoke both directions
- **removes:** none
- **baseline:** no such command
- **rollback:** remove command + handlers
- **state-after:** working
- **notes:** Confirm dialog mentions cost/time; disabled when peer unavailable.

### T8 — Setting, docs, Known limits
- **intent:** `grok.peerAgent.enabled` default off; README/CLAUDE Known limits: live peer MCP vs disk suite vs non-interchangeable User Workflows.
- **files:** `package.json` settings, `README.md`, `CLAUDE.md`, `docs/grokbit-workflows.md` or peer research doc link
- **cwd:** none
- **depends:** T6, T7
- **verify:** `npm test`; setting appears in package contributes
- **removes:** none
- **baseline:** docs claim disk interop only
- **rollback:** checkout docs/package settings
- **state-after:** working
- **notes:** Explicitly say Rhai/JS workflows still don’t call the other CLI.

### T9 — Full suite green
- **intent:** No regressions across backends, handoff, capabilities.
- **files:** none
- **cwd:** none
- **depends:** T1–T8
- **verify:** `npm test`
- **removes:** none
- **baseline:** none
- **rollback:** n/a
- **state-after:** working
- **notes:** Live peer probe remains manual/`test:live` optional — never required in CI.

## Verification matrix

| Done criterion | Proven by |
|---|---|
| Grok→Claude nested wait | T1+T5+T6; live smoke |
| Claude→Grok nested wait | T1+T5+T6; live smoke |
| Peer UI + permissions | T6 |
| User command either tab | T7 |
| Depth cap 1 | T3+T4 (no MCP on peer) |
| Honest failure if other missing | T3+T7 |
| Tests green | T9 |
| ADR | T2 |
| Probe-gated default | T1+T8 |

## Disposition summary

| Disposition | Count | Handled by |
|---|---|---|
| REPLACE | 1 | T5 empty mcpServers when feature on |
| DEPRECATE | 0 | — |
| COEXIST | 1 | disk suite portability docs |
| LEAVE | 4+ | rejected Continue plan; agent-switch; User Workflow bridge; native subagent inspector |

## Open assumptions
- mcpServers honor by both agents — **UNVERIFIED until T1**
- Headless peer permission UX vs forced visible tab — ADR after T1
- Default remains **off** until probes PASS
- Peer omits MCP to enforce depth 1
- Cost confirmation on user command; tool description warns agents/users

## Approval
- [x] Human approved — 2026-08-10 (plan-review UI); re-confirmed `[Plan approved]` after how-it-works description

---

## Gate summary

**Three sentences:** Inject a Grokbit MCP server into ACP `session/new` so the live agent can call `run_peer_agent` and **block** until the extension runs the **other** CLI over ACP. Expose the same runner as a **command on either tab**. Keep suite disk artifacts and User Workflows unchanged; gate default-off on a dual-backend MCP probe + ADR.

**Blast radius:** new MCP resource + host PeerRunner + `acp.ts` mcpServers + webview peer UI + setting/docs; 0 new npm deps preferred; high behavioral risk → probe + default off.

**Rejected alternative:** sequential Continue-on-other-agent via `.grokbit/plans` only.
