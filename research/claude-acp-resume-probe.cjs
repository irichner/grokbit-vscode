#!/usr/bin/env node
/**
 * P5 probe (docs/plans/claude-code-backend.md WP5) — does `session/load` replay
 * reconstruct the transcript well enough to drive Grokbit's resume UI?
 *
 * Modeled on claude-acp-spawn-probe.cjs (P1/P2): same Electron-as-Node spawn
 * (`process.execPath` + ELECTRON_RUN_AS_NODE=1). Drives TWO separate adapter
 * processes against the SAME session id/cwd — the first runs a real turn (text +
 * a Write + an Edit + a Bash command, so every tool `kind` the ACP wire uses is
 * exercised), the second is a cold `session/load` of that id, simulating "close
 * the tab, reopen it later" the way sidebar.ts's resumeId path does. Every
 * `session/update` the second adapter emits during replay is logged and
 * classified so the report below reflects exactly what came back, not what the
 * plan assumed. Manual diagnostic probe — never run by `npm test` or CI.
 *
 * ⚠ Must run with CLAUDECODE unset — Claude Code refuses to launch inside
 * another Claude Code session ("Nested sessions share runtime resources and
 * will crash all active sessions"). This script strips CLAUDECODE /
 * CLAUDE_CODE_ENTRYPOINT / CLAUDE_CODE_SSE_PORT from the spawn env itself
 * (mirroring buildClaudeAdapterEnv in src/claude-locator.ts) so it also works
 * when invoked from inside a Claude Code terminal, which is exactly how this
 * probe was authored and run.
 *
 * Prereqs (not committed to the repo — a measured 120MB unpacked, see the plan's
 * "Packaging decision"):
 *   npm i --no-save @zed-industries/claude-code-acp@0.16.2
 *
 * Usage:
 *   node research/claude-acp-resume-probe.cjs
 *   Env overrides:
 *     VSCODE_EXE=<path to Code.exe / electron>   (defaults to this machine's install)
 *     CLAUDE_ACP_ENTRY=<path to dist/index.js>   (defaults to ./node_modules/@zed-industries/...)
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_ELECTRON = "C:\\Users\\israe\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe";
const ELECTRON = process.env.VSCODE_EXE || DEFAULT_ELECTRON;
const ADAPTER =
  process.env.CLAUDE_ACP_ENTRY ||
  path.join(__dirname, "..", "node_modules", "@zed-industries", "claude-code-acp", "dist", "index.js");
const WORK = path.join(__dirname, "work-resume");
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

function spawnEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_CODE_SSE_PORT;
  env.ELECTRON_RUN_AS_NODE = "1";
  return env;
}

/** One adapter connection: JSON-RPC over stdio, plus the client-side fs/terminal/
 *  permission handlers real Grokbit wires up (see src/sidebar.ts startSession). */
function makeAdapter(label) {
  const proc = spawn(ELECTRON, [ADAPTER], { cwd: WORK, env: spawnEnv(), stdio: ["pipe", "pipe", "pipe"] });
  const t0 = Date.now();
  const ms = () => String(Date.now() - t0).padStart(6);
  let nextId = 1;
  const pending = new Map();
  const updates = [];

  proc.stderr.on("data", (d) => process.stderr.write(`${ms()} [${label} stderr] ${d}`));
  proc.on("exit", (code) => console.log(`${ms()} [${label}] adapter exited code=${code}`));

  const send = (o) => proc.stdin.write(JSON.stringify(o) + "\n");
  const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
  function request(method, params, timeoutMs = 60000) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      send({ jsonrpc: "2.0", id, method, params });
      setTimeout(() => { if (pending.delete(id)) reject(new Error(`timeout: ${method}`)); }, timeoutMs);
    });
  }

  async function handleServerRequest(msg) {
    const { method, id, params } = msg;
    switch (method) {
      case "fs/read_text_file": {
        let content = "";
        try { content = fs.readFileSync(params.path, "utf8"); } catch { /* new file */ }
        return reply(id, { content });
      }
      case "fs/write_text_file": {
        fs.mkdirSync(path.dirname(params.path), { recursive: true });
        fs.writeFileSync(params.path, params.content ?? "", "utf8");
        return reply(id, {});
      }
      case "terminal/create": {
        const tid = `t${Date.now()}`;
        const child = spawn(params.command, { shell: true, cwd: params.cwd ?? WORK });
        const rec = { out: "", exit: null, waiters: [] };
        child.stdout.on("data", (d) => (rec.out += d));
        child.stderr.on("data", (d) => (rec.out += d));
        child.on("exit", (code) => { rec.exit = { exitCode: code ?? 0 }; rec.waiters.forEach((w) => w(rec.exit)); });
        proc.__terms = proc.__terms || new Map();
        proc.__terms.set(tid, rec);
        return reply(id, { terminalId: tid });
      }
      case "terminal/output": {
        const r = proc.__terms?.get(params.terminalId);
        return reply(id, { output: r?.out ?? "", exitStatus: r?.exit ?? null, truncated: false });
      }
      case "terminal/wait_for_exit": {
        const r = proc.__terms?.get(params.terminalId);
        if (!r) return reply(id, { exitCode: 0 });
        if (r.exit) return reply(id, r.exit);
        return r.waiters.push((e) => reply(id, e));
      }
      case "terminal/kill":
      case "terminal/release":
        return reply(id, {});
      case "session/request_permission": {
        const opts = params.options ?? [];
        const allow = opts.find((o) => o.kind === "allow_always") ?? opts.find((o) => o.kind === "allow_once") ?? opts[0];
        return reply(id, { outcome: { outcome: "selected", optionId: allow?.optionId } });
      }
      default:
        console.log(`${ms()} [${label} SERVER REQ] ${method} ${JSON.stringify(params).slice(0, 160)}`);
        if (id != null) reply(id, {});
    }
  }

  readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
      const p = pending.get(m.id);
      if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
      return;
    }
    if (m.method === "session/update") {
      updates.push(m.params?.update ?? {});
      const u = m.params?.update ?? {};
      const kind = u.sessionUpdate;
      let detail = "";
      if (kind === "user_message_chunk" || kind === "agent_message_chunk" || kind === "agent_thought_chunk") {
        detail = JSON.stringify((u.content?.text ?? "").slice(0, 80));
      } else if (kind === "tool_call" || kind === "tool_call_update") {
        detail = `kind=${u.kind ?? "?"} status=${u.status ?? "?"} title=${JSON.stringify(u.title)}`;
      } else if (kind === "current_mode_update") {
        detail = `mode=${u.currentModeId}`;
      } else if (kind === "available_commands_update") {
        detail = `${u.availableCommands?.length ?? 0} commands`;
      } else {
        detail = JSON.stringify(u).slice(0, 100);
      }
      console.log(`${ms()} [${label} update] ${kind} ${detail}`);
      return;
    }
    void handleServerRequest(m);
  });

  return { proc, request, updates, ms, kill: () => proc.kill() };
}

/** Wait for a real process exit (not just kill() returning) so the second
 *  adapter doesn't race the first one's stdio teardown / any late file flush. */
function waitExit(proc) {
  return new Promise((resolve) => proc.on("exit", () => resolve()));
}

/** Dump the LAST `type:"assistant"` record's `message.usage` from the raw
 *  `.jsonl` — the candidate on-disk token-usage source for WP5 deliverable 5
 *  (grok recovers resume-time context usage from signals.json; Claude has no
 *  verified equivalent per WP4 — this probe checks for one). */
function lastAssistantUsage(jsonlPath) {
  let lines;
  try { lines = fs.readFileSync(jsonlPath, "utf8").split(/\r?\n/); } catch { return undefined; }
  let last;
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    let rec;
    try { rec = JSON.parse(s); } catch { continue; }
    if (rec.type === "assistant" && rec.message?.usage) last = rec.message.usage;
  }
  return last;
}

(async () => {
  const a = makeAdapter("A");
  try {
    await a.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    });
    const s = await a.request("session/new", { cwd: WORK, mcpServers: [] });
    const sessionId = s.sessionId;
    console.log(`\n${a.ms()} [A] session=${sessionId}\n`);

    console.log(`${a.ms()} --- TURN 1: plain text (expect agent_message_chunk on replay) ---`);
    await a.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: "Reply with exactly: two plus two is four. Do not use any tools." }],
    });

    console.log(`\n${a.ms()} --- TURN 2: Write + Edit (expect tool_call kind=edit on replay) ---`);
    await a.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: "Create notes.txt containing 'hello'. Then Edit it to say 'goodbye'. Be terse." }],
    });

    console.log(`\n${a.ms()} --- TURN 3: Bash (expect tool_call kind=execute on replay) ---`);
    await a.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: "Run: node -e \"console.log('from-shell')\" and report the output. Be terse." }],
    });

    console.log(`\n${a.ms()} --- TURN 4: Read (expect tool_call kind=read on replay) ---`);
    await a.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: "Read notes.txt and quote its exact contents. Be terse." }],
    });

    console.log(`\n${a.ms()} [A] all turns complete — tearing the first adapter down`);
    a.kill();
    await waitExit(a.proc);

    // Locate the session's .jsonl the same way ClaudeSessionStore does, and
    // check for an on-disk usage field BEFORE the second adapter touches it.
    const claudeHome = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude");
    const projectDir = path.join(claudeHome, "projects", WORK.replace(/[^A-Za-z0-9]/g, "-"));
    const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);
    console.log(`\n[probe] session file: ${jsonlPath} (exists=${fs.existsSync(jsonlPath)})`);
    const usage = lastAssistantUsage(jsonlPath);
    console.log(`[probe] last assistant record's message.usage: ${JSON.stringify(usage)}`);

    console.log(`\n===== RELOAD: fresh adapter process, session/load(${sessionId}) =====\n`);
    const b = makeAdapter("B");
    await b.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    });
    const loadRes = await b.request("session/load", { sessionId, cwd: WORK, mcpServers: [] });
    console.log(`\n${b.ms()} [B] session/load RESPONSE keys: ${JSON.stringify(Object.keys(loadRes ?? {}))}`);
    console.log(`${b.ms()} [B] session/load RESPONSE (first 500 chars): ${JSON.stringify(loadRes).slice(0, 500)}`);

    // ---- report ----
    const updates = b.updates;
    const byKind = {};
    for (const u of updates) byKind[u.sessionUpdate] = (byKind[u.sessionUpdate] ?? 0) + 1;
    const toolCalls = updates.filter((u) => u.sessionUpdate === "tool_call");
    const toolUpdates = updates.filter((u) => u.sessionUpdate === "tool_call_update");
    const userChunks = updates.filter((u) => u.sessionUpdate === "user_message_chunk");
    const agentChunks = updates.filter((u) => u.sessionUpdate === "agent_message_chunk");
    const toolKinds = [...new Set(toolCalls.map((u) => u.kind ?? "MISSING"))];
    // NOTE: every tool_call/tool_call_update carries a `_meta.claudeCode.toolName`
    // field (e.g. "mcp__acp__Write") — that is NOT token/usage meta, just which
    // MCP tool fired. Check for an actual nested usage/tokenUsage shape instead
    // of merely truthy `_meta`, or this false-positives on every tool call.
    const anyMetaOnUpdates = updates.some((u) => u._meta?.usage || u._meta?.tokenUsage || u.usage || u.tokenUsage);

    console.log(`\n===== P5 REPORT =====`);
    console.log(`session/update counts by kind: ${JSON.stringify(byKind)}`);
    console.log(`user_message_chunk count      : ${userChunks.length} (user text present: ${userChunks.some((u) => (u.content?.text ?? "").trim())})`);
    console.log(`agent_message_chunk count     : ${agentChunks.length} (assistant text present: ${agentChunks.some((u) => (u.content?.text ?? "").trim())})`);
    console.log(`tool_call count               : ${toolCalls.length}, kinds seen: ${JSON.stringify(toolKinds)}`);
    console.log(`tool_call_update count        : ${toolUpdates.length}, statuses: ${JSON.stringify([...new Set(toolUpdates.map((u) => u.status))])}`);
    console.log(`tool_call.kind survives replay: ${toolCalls.length > 0 && !toolKinds.includes("MISSING") ? "YES" : "NO/PARTIAL"}`);
    console.log(`token/usage meta on session/update or session/load response: ${anyMetaOnUpdates || !!(loadRes && (loadRes._meta || loadRes.usage)) ? "YES" : "NO"}`);
    console.log(`on-disk message.usage (last assistant record, .jsonl)      : ${usage ? "YES — " + JSON.stringify(usage) : "NO"}`);
    console.log(`notes.txt final content on disk: ${JSON.stringify(fs.existsSync(path.join(WORK, "notes.txt")) ? fs.readFileSync(path.join(WORK, "notes.txt"), "utf8").trim() : undefined)}`);

    b.kill();
  } catch (e) {
    console.error(`\n[probe] FAIL: ${e.message ?? JSON.stringify(e)}`);
    a.kill();
  }
})();
