#!/usr/bin/env node
/**
 * P1/P2 probe (docs/plans/claude-code-backend.md WP1) — can the extension host
 * drive @zed-industries/claude-code-acp?
 *
 * Spawns the adapter the way the VS Code extension has to: the Electron binary
 * (`process.execPath` in the real extension host) with ELECTRON_RUN_AS_NODE=1. The
 * adapter's OWN child (the Agent SDK's bundled `claude` cli.js, spawned with
 * `executable: process.execPath`) inherits that env var — whether that grandchild
 * survives the trip is the real thing under test. Manual diagnostic probe — never
 * run by `npm test` or CI. See research/claude-code-backend.md for the verified
 * results and `src/claude-locator.ts` for the resulting spawn plumbing.
 *
 * Prereqs (not committed to the repo — a measured 120MB unpacked, see the plan's
 * "Packaging decision"):
 *   npm i --no-save @zed-industries/claude-code-acp@0.16.2
 *
 * Usage:
 *   node research/claude-acp-spawn-probe.cjs [--node]
 *     --node   run the adapter under plain `node` instead of Electron (control run)
 *   Env overrides:
 *     VSCODE_EXE=<path to Code.exe / electron>   (defaults to this machine's install)
 *     CLAUDE_ACP_ENTRY=<path to dist/index.js>   (defaults to ./node_modules/@zed-industries/...)
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_ELECTRON = "C:\\Users\\israe\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe";
const ELECTRON = process.env.VSCODE_EXE || DEFAULT_ELECTRON;
const ADAPTER =
  process.env.CLAUDE_ACP_ENTRY ||
  path.join(__dirname, "..", "node_modules", "@zed-industries", "claude-code-acp", "dist", "index.js");
const USE_NODE = process.argv.includes("--node");

const cmd = USE_NODE ? process.execPath : ELECTRON;
const env = { ...process.env };
if (!USE_NODE) env.ELECTRON_RUN_AS_NODE = "1";

console.log(`[probe] host   = ${USE_NODE ? "plain node" : "Electron (ELECTRON_RUN_AS_NODE=1)"}`);
console.log(`[probe] cmd    = ${cmd}`);
console.log(`[probe] script = ${ADAPTER}\n`);

const proc = spawn(cmd, [ADAPTER], { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"] });

let nextId = 1;
const pending = new Map();
const t0 = Date.now();
const ms = () => String(Date.now() - t0).padStart(6);

proc.stderr.on("data", (d) => process.stderr.write(`${ms()} [stderr] ${d}`));
proc.on("exit", (code) => { console.log(`\n${ms()} [probe] adapter exited: code=${code}`); process.exit(code ?? 0); });
proc.on("error", (e) => { console.error(`${ms()} [probe] SPAWN ERROR: ${e.message}`); process.exit(1); });

function send(obj) { proc.stdin.write(JSON.stringify(obj) + "\n"); }
function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
    setTimeout(() => { if (pending.delete(id)) reject(new Error(`timeout: ${method}`)); }, 120000);
  });
}

readline.createInterface({ input: proc.stdout }).on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { console.log(`${ms()} [non-json] ${line.slice(0, 200)}`); return; }

  if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(msg.error) : p.resolve(msg.result); }
    return;
  }
  if (msg.method === "session/update") {
    const u = msg.params?.update ?? {};
    const kind = u.sessionUpdate;
    let detail = "";
    if (kind === "agent_message_chunk" || kind === "agent_thought_chunk") detail = JSON.stringify(u.content?.text ?? "").slice(0, 90);
    else if (kind === "tool_call" || kind === "tool_call_update") detail = `${u.title ?? ""} [${u.kind ?? ""}] ${u.status ?? ""}`;
    else if (kind === "available_commands_update") detail = `${u.availableCommands?.length ?? 0} commands`;
    console.log(`${ms()} [update] ${kind} ${detail}`);
    return;
  }
  // Server → client request. Log which ones the adapter actually routes to us.
  console.log(`${ms()} [SERVER REQ] ${msg.method} ${JSON.stringify(msg.params).slice(0, 160)}`);
  if (msg.id != null) send({ jsonrpc: "2.0", id: msg.id, result: {} });
});

(async () => {
  try {
    const init = await request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    });
    console.log(`${ms()} [OK] initialize -> ${JSON.stringify(init).slice(0, 300)}\n`);

    const s = await request("session/new", { cwd: process.cwd(), mcpServers: [] });
    console.log(`${ms()} [OK] session/new -> sessionId=${s.sessionId}`);
    console.log(`${ms()}      modes  = ${JSON.stringify(s.modes?.availableModes?.map((m) => m.id))}`);
    console.log(`${ms()}      models = ${JSON.stringify(s.models?.availableModels?.map((m) => m.modelId))}`);
    console.log(`${ms()}      current= ${s.models?.currentModelId}\n`);

    const r = await request("session/prompt", {
      sessionId: s.sessionId,
      prompt: [{ type: "text", text: "Reply with exactly: ok. Do not use any tools." }],
    });
    console.log(`\n${ms()} [OK] session/prompt -> ${JSON.stringify(r)}`);
    console.log(`\n${ms()} [probe] PASS — grandchild claude process ran a real turn.`);
  } catch (e) {
    console.error(`\n${ms()} [probe] FAIL: ${e.message ?? JSON.stringify(e)}`);
  } finally {
    proc.kill();
  }
})();
