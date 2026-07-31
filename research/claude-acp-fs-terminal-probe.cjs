#!/usr/bin/env node
/**
 * P3/P4 probe (docs/plans/claude-code-backend.md WP1) — does the adapter route
 * Claude's Edit/Write through the CLIENT's fs/* handlers and Bash through the
 * CLIENT's terminal/* handlers?
 *
 * That is what makes the extension's permission cards, inline diffs, plan gate,
 * changed-files strip and TerminalManager work for Claude with no new protocol
 * code. Also captures the shape of `session/request_permission` (notably: no
 * `toolCall.kind` — see research/claude-code-backend.md). Manual diagnostic
 * probe — never run by `npm test` or CI.
 *
 * Prereqs (not committed to the repo — a measured 120MB unpacked, see the plan's
 * "Packaging decision"):
 *   npm i --no-save @zed-industries/claude-code-acp@0.16.2
 *
 * Usage:
 *   node research/claude-acp-fs-terminal-probe.cjs
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
const WORK = path.join(__dirname, "work");
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

const seen = { fsRead: 0, fsWrite: 0, termCreate: 0, permission: 0, permKinds: new Set(), toolKinds: new Set() };
const proc = spawn(ELECTRON, [ADAPTER], {
  cwd: WORK,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: ["pipe", "pipe", "pipe"],
});

let nextId = 1;
const pending = new Map();
const terms = new Map();
const t0 = Date.now();
const ms = () => String(Date.now() - t0).padStart(6);

proc.stderr.on("data", (d) => process.stderr.write(`${ms()} [stderr] ${d}`));
proc.on("exit", (c) => console.log(`${ms()} [probe] adapter exited code=${c}`));

const send = (o) => proc.stdin.write(JSON.stringify(o) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
function request(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    send({ jsonrpc: "2.0", id, method, params });
    setTimeout(() => { if (pending.delete(id)) rej(new Error(`timeout: ${method}`)); }, 300000);
  });
}

async function handleServerRequest(msg) {
  const { method, id, params } = msg;
  switch (method) {
    case "fs/read_text_file": {
      seen.fsRead++;
      console.log(`${ms()} [CLIENT fs/read]  ${params.path}`);
      let content = "";
      try { content = fs.readFileSync(params.path, "utf8"); } catch { /* new file */ }
      return reply(id, { content });
    }
    case "fs/write_text_file": {
      seen.fsWrite++;
      console.log(`${ms()} [CLIENT fs/write] ${params.path} (${(params.content ?? "").length} chars)`);
      fs.mkdirSync(path.dirname(params.path), { recursive: true });
      fs.writeFileSync(params.path, params.content ?? "", "utf8");
      return reply(id, {});
    }
    case "terminal/create": {
      seen.termCreate++;
      console.log(`${ms()} [CLIENT terminal/create] ${JSON.stringify(params.command).slice(0, 120)}`);
      const tid = `t${terms.size + 1}`;
      const child = spawn(params.command, { shell: true, cwd: params.cwd ?? WORK });
      const rec = { child, out: "", exit: null, waiters: [] };
      child.stdout.on("data", (d) => (rec.out += d));
      child.stderr.on("data", (d) => (rec.out += d));
      child.on("exit", (code) => { rec.exit = { exitCode: code ?? 0 }; rec.waiters.forEach((w) => w(rec.exit)); });
      terms.set(tid, rec);
      return reply(id, { terminalId: tid });
    }
    case "terminal/output": {
      const r = terms.get(params.terminalId);
      return reply(id, { output: r?.out ?? "", exitStatus: r?.exit ?? null, truncated: false });
    }
    case "terminal/wait_for_exit": {
      const r = terms.get(params.terminalId);
      if (!r) return reply(id, { exitCode: 0 });
      if (r.exit) return reply(id, r.exit);
      return r.waiters.push((e) => reply(id, e));
    }
    case "terminal/kill": { terms.get(params.terminalId)?.child.kill(); return reply(id, {}); }
    case "terminal/release": { terms.delete(params.terminalId); return reply(id, {}); }
    case "session/request_permission": {
      seen.permission++;
      const tc = params.toolCall ?? {};
      seen.permKinds.add(tc.kind ?? "?");
      const opts = params.options ?? [];
      console.log(`${ms()} [CLIENT PERMISSION] kind=${tc.kind} title=${JSON.stringify(tc.title)}`);
      console.log(`${ms()}       options: ${JSON.stringify(opts.map((o) => `${o.optionId}:${o.kind}`))}`);
      if (tc.rawInput) console.log(`${ms()}       rawInput keys: ${JSON.stringify(Object.keys(tc.rawInput))}`);
      const allow = opts.find((o) => o.kind === "allow_once") ?? opts.find((o) => o.kind === "allow_always") ?? opts[0];
      return reply(id, { outcome: { outcome: "selected", optionId: allow.optionId } });
    }
    default:
      console.log(`${ms()} [SERVER REQ ${method}] ${JSON.stringify(params).slice(0, 140)}`);
      if (id != null) reply(id, {});
  }
}

readline.createInterface({ input: proc.stdout }).on("line", (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.rej(m.error) : p.res(m.result); }
    return;
  }
  if (m.method === "session/update") {
    const u = m.params?.update ?? {};
    if (u.sessionUpdate === "tool_call") {
      seen.toolKinds.add(u.kind ?? "?");
      console.log(`${ms()} [tool_call] kind=${u.kind} ${JSON.stringify(u.title).slice(0, 80)}`);
    } else if (u.sessionUpdate === "tool_call_update" && u.status === "completed") {
      const hasDiff = JSON.stringify(u.content ?? "").includes("diff");
      console.log(`${ms()} [tool_done] ${u.status}${hasDiff ? " (carries diff content)" : ""}`);
    } else if (u.sessionUpdate === "agent_message_chunk") {
      const t = u.content?.text ?? ""; if (t.trim()) console.log(`${ms()} [text] ${JSON.stringify(t).slice(0, 80)}`);
    }
    return;
  }
  void handleServerRequest(m);
});

(async () => {
  try {
    await request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    });
    const s = await request("session/new", { cwd: WORK, mcpServers: [] });
    console.log(`${ms()} [OK] session=${s.sessionId}\n`);

    console.log(`${ms()} --- TASK 1: create + edit a file (expect fs/write on the CLIENT) ---`);
    await request("session/prompt", {
      sessionId: s.sessionId,
      prompt: [{ type: "text", text: "Create a file notes.txt containing exactly the line 'hello'. Then use Edit to change 'hello' to 'goodbye'. Be terse." }],
    });

    console.log(`\n${ms()} --- TASK 2: run a shell command (expect terminal/create on the CLIENT) ---`);
    await request("session/prompt", {
      sessionId: s.sessionId,
      prompt: [{ type: "text", text: "Run the shell command: node -e \"console.log('from-shell')\" and tell me its output. Be terse." }],
    });

    console.log(`\n===== RESULTS =====`);
    console.log(`P3 fs/write_text_file on client : ${seen.fsWrite > 0 ? "YES" : "NO"} (${seen.fsWrite} calls, ${seen.fsRead} reads)`);
    console.log(`P4 terminal/create on client    : ${seen.termCreate > 0 ? "YES" : "NO"} (${seen.termCreate} calls)`);
    console.log(`   permission requests          : ${seen.permission} (kinds: ${[...seen.permKinds].join(", ") || "none"})`);
    console.log(`   tool_call kinds seen         : ${[...seen.toolKinds].join(", ")}`);
    console.log(`   notes.txt on disk            : ${JSON.stringify(fs.readFileSync(path.join(WORK, "notes.txt"), "utf8").trim())}`);
  } catch (e) {
    console.error(`\n[probe] FAIL: ${e.message ?? JSON.stringify(e)}`);
  } finally {
    proc.kill();
  }
})();
