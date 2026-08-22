#!/usr/bin/env node
/**
 * T1 gate — does Grok / Claude ACP honor client-supplied mcpServers and can
 * the model call a hello-world MCP tool?
 *
 * Ground truth (2026-08): Grok initialize advertises mcpCapabilities
 * { http: true, sse: true } — NOT stdio. This probe defaults to HTTP MCP.
 *
 * Manual diagnostic — never in npm test/CI. Burns credits if the model turn runs.
 *
 * Usage:
 *   node research/peer-mcp-probe.cjs              # try both backends (HTTP MCP)
 *   node research/peer-mcp-probe.cjs --grok
 *   node research/peer-mcp-probe.cjs --claude
 *   node research/peer-mcp-probe.cjs --no-prompt  # session/new only
 *   node research/peer-mcp-probe.cjs --stdio      # also try stdio transport (expect Grok skip/fail)
 *
 * Env:
 *   GROK_BIN, CLAUDE_ACP_ENTRY, VSCODE_EXE
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const readline = require("node:readline");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const HELLO_STDIO = path.join(__dirname, "fixtures", "hello-mcp-server.cjs");
const HELLO_HTTP = path.join(__dirname, "fixtures", "hello-mcp-http-server.cjs");
const NO_PROMPT = process.argv.includes("--no-prompt");
const TRY_STDIO = process.argv.includes("--stdio");
const onlyGrok = process.argv.includes("--grok") && !process.argv.includes("--claude");
const onlyClaude = process.argv.includes("--claude") && !process.argv.includes("--grok");
const wantGrok = onlyGrok || (!onlyGrok && !onlyClaude);
const wantClaude = onlyClaude || (!onlyGrok && !onlyClaude);

const DEFAULT_CLAUDE_ENTRY = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Code",
  "User",
  "globalStorage",
  "grokbit.grokbit",
  "claude-adapter",
  "node_modules",
  "@zed-industries",
  "claude-code-acp",
  "dist",
  "index.js",
);

function resolveGrok() {
  if (process.env.GROK_BIN && fs.existsSync(process.env.GROK_BIN)) return process.env.GROK_BIN;
  const win = path.join(os.homedir(), ".grok", "bin", "grok.exe");
  if (fs.existsSync(win)) return win;
  const unix = path.join(os.homedir(), ".grok", "bin", "grok");
  if (fs.existsSync(unix)) return unix;
  return "grok";
}

function resolveClaudeEntry() {
  if (process.env.CLAUDE_ACP_ENTRY && fs.existsSync(process.env.CLAUDE_ACP_ENTRY)) {
    return process.env.CLAUDE_ACP_ENTRY;
  }
  const local = path.join(ROOT, "node_modules", "@zed-industries", "claude-code-acp", "dist", "index.js");
  if (fs.existsSync(local)) return local;
  if (fs.existsSync(DEFAULT_CLAUDE_ENTRY)) return DEFAULT_CLAUDE_ENTRY;
  return null;
}

function startHttpHello() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [HELLO_HTTP, "0"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let url = null;
    const onOut = (d) => {
      const s = d.toString();
      const m = s.match(/HELLO_MCP_URL=(http:\/\/\S+)/);
      if (m) {
        url = m[1];
        resolve({
          url,
          kill: () => {
            try {
              proc.kill();
            } catch { /* ignore */ }
          },
        });
      }
    };
    proc.stdout.on("data", onOut);
    proc.stderr.on("data", (d) => process.stderr.write(`[http-hello] ${d}`));
    proc.on("error", reject);
    setTimeout(() => {
      if (!url) reject(new Error("HTTP hello MCP did not print URL"));
    }, 5000);
  });
}

function mcpHttpEntry(url) {
  return { type: "http", name: "grokbit-hello", url, headers: [] };
}

function mcpStdioEntry() {
  return {
    type: "stdio",
    name: "grokbit-hello-stdio",
    command: process.execPath,
    args: [HELLO_STDIO],
    env: [],
  };
}

function createAcpClient({ cmd, args, env, label }) {
  const proc = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32" && cmd === "grok",
  });
  let nextId = 1;
  const pending = new Map();
  const updates = [];
  const t0 = Date.now();
  const ms = () => String(Date.now() - t0).padStart(6);

  proc.stderr.on("data", (d) => {
    const s = d.toString();
    // Noise from unrelated configured MCP auth failures — keep one line.
    if (/AuthRequired|invalid_token|mcp\.getrunpod/i.test(s)) {
      process.stderr.write(`${ms()} [${label}-stderr] (mcp auth noise trimmed)\n`);
      return;
    }
    process.stderr.write(`${ms()} [${label}-stderr] ${s.slice(0, 300)}`);
  });

  function send(obj) {
    proc.stdin.write(JSON.stringify(obj) + "\n");
  }
  function request(method, params, timeoutMs = 120000) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`timeout: ${method}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        msg.error ? p.reject(msg.error) : p.resolve(msg.result);
      }
      return;
    }
    if (msg.method === "session/update") {
      const u = msg.params?.update ?? {};
      updates.push(u);
      const kind = u.sessionUpdate;
      if (kind === "tool_call" || kind === "tool_call_update") {
        console.log(
          `${ms()} [${label}] ${kind} title=${JSON.stringify(u.title || "")} kind=${u.kind || ""} status=${u.status || ""} raw=${JSON.stringify(u.rawInput || u).slice(0, 120)}`,
        );
      } else if (kind === "agent_message_chunk") {
        const t = u.content?.text || "";
        if (t) process.stdout.write(t);
      }
      return;
    }
    if (msg.method && msg.id != null) {
      console.log(`${ms()} [${label}] SERVER REQ ${msg.method}`);
      if (msg.method === "fs/read_text_file") {
        let content = "";
        try {
          content = fs.readFileSync(msg.params.path, "utf8");
        } catch { /* empty */ }
        send({ jsonrpc: "2.0", id: msg.id, result: { content } });
      } else if (msg.method === "session/request_permission") {
        const opts = msg.params?.options || [];
        const allow =
          opts.find((o) => o.kind === "allow_once" || o.kind === "allow_always" || o.optionId === "allow") ||
          opts[0];
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: { outcome: { outcome: "selected", optionId: allow?.optionId || "allow" } },
        });
      } else if (msg.method?.startsWith("terminal/")) {
        if (msg.method === "terminal/create") {
          send({ jsonrpc: "2.0", id: msg.id, result: { terminalId: "t-peer" } });
        } else if (msg.method === "terminal/output") {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: { output: "", exitStatus: { exitCode: 0 }, truncated: false },
          });
        } else if (msg.method === "terminal/wait_for_exit") {
          send({ jsonrpc: "2.0", id: msg.id, result: { exitCode: 0 } });
        } else {
          send({ jsonrpc: "2.0", id: msg.id, result: {} });
        }
      } else {
        send({ jsonrpc: "2.0", id: msg.id, result: {} });
      }
    }
  });

  return {
    label,
    request,
    updates,
    kill: () => {
      try {
        proc.kill();
      } catch { /* ignore */ }
    },
  };
}

function toolMentioned(updates) {
  const blob = JSON.stringify(updates).toLowerCase();
  return (
    blob.includes("\"ping\"") ||
    blob.includes("pong") ||
    blob.includes("grokbit-hello") ||
    blob.includes("mcp_ping_ok")
  );
}

function extractMcpCaps(init) {
  const caps = init?.agentCapabilities || init?.capabilities || {};
  return caps.mcpCapabilities || caps.mcp || null;
}

async function runBackend({ label, cmd, args, env, mcpServers }) {
  const verdict = {
    backend: label,
    transport: mcpServers[0]?.type || "none",
    sessionNew: "SKIP",
    mcpInInit: "SKIP",
    toolCall: "SKIP",
    notes: [],
  };
  const client = createAcpClient({ cmd, args, env, label });
  try {
    const init = await client.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    });
    const mcpCaps = extractMcpCaps(init);
    verdict.notes.push(`mcpCapabilities=${JSON.stringify(mcpCaps)}`);
    verdict.mcpInInit = mcpCaps ? JSON.stringify(mcpCaps) : "ABSENT";

    const ns = await client.request("session/new", {
      cwd: ROOT,
      mcpServers,
    });
    verdict.sessionNew = ns?.sessionId ? "OK" : "FAIL";
    verdict.notes.push(`sessionId=${ns?.sessionId}`);

    if (NO_PROMPT) {
      verdict.toolCall = "SKIPPED (--no-prompt)";
      return verdict;
    }

    const promptText =
      "You have an MCP server named grokbit-hello with a tool `ping`. " +
      "Call the ping tool now (do not invent the result). Then reply with exactly: MCP_PING_OK.";
    await client.request(
      "session/prompt",
      { sessionId: ns.sessionId, prompt: [{ type: "text", text: promptText }] },
      300000,
    );
    const called = toolMentioned(client.updates);
    verdict.toolCall = called ? "LIKELY_CALLED" : "NOT_OBSERVED";
    verdict.notes.push(`updates=${client.updates.length} toolish=${called}`);
  } catch (e) {
    verdict.sessionNew = verdict.sessionNew === "SKIP" ? "FAIL" : verdict.sessionNew;
    verdict.notes.push(`error: ${e.message || JSON.stringify(e)}`);
  } finally {
    client.kill();
  }
  return verdict;
}

function summarize(v) {
  const status =
    v.sessionNew !== "OK"
      ? "FAIL"
      : v.toolCall === "LIKELY_CALLED"
        ? "PASS"
        : String(v.toolCall).startsWith("SKIPPED")
          ? "PARTIAL"
          : "INCONCLUSIVE";
  return { ...v, status };
}

(async () => {
  if (!fs.existsSync(HELLO_HTTP)) {
    console.error("missing", HELLO_HTTP);
    process.exit(2);
  }

  const httpHello = await startHttpHello();
  console.log("HTTP hello at", httpHello.url);

  // Sanity: local POST initialize
  try {
    const pingLocal = await new Promise((resolve, reject) => {
      const req = http.request(
        httpHello.url,
        { method: "POST", headers: { "content-type": "application/json" } },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        },
      );
      req.on("error", reject);
      req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping" } }));
    });
    console.log("local tools/call =>", pingLocal.slice(0, 120));
  } catch (e) {
    console.error("local HTTP MCP failed:", e.message);
  }

  const results = [];
  const httpServers = [mcpHttpEntry(httpHello.url)];

  if (wantGrok) {
    console.log(`\n=== GROK HTTP MCP ===`);
    results.push(
      summarize(
        await runBackend({
          label: "grok-http",
          cmd: resolveGrok(),
          args: ["agent", "stdio"],
          env: {},
          mcpServers: httpServers,
        }),
      ),
    );
    if (TRY_STDIO) {
      console.log(`\n=== GROK STDIO MCP (expect unsupported) ===`);
      results.push(
        summarize(
          await runBackend({
            label: "grok-stdio",
            cmd: resolveGrok(),
            args: ["agent", "stdio"],
            env: {},
            mcpServers: [mcpStdioEntry()],
          }),
        ),
      );
    }
  }

  if (wantClaude) {
    const entry = resolveClaudeEntry();
    console.log(`\n=== CLAUDE HTTP MCP (${entry || "MISSING"}) ===`);
    if (!entry) {
      results.push(
        summarize({
          backend: "claude-http",
          transport: "http",
          sessionNew: "FAIL",
          mcpInInit: "SKIP",
          toolCall: "SKIP",
          notes: ["claude-code-acp not found; set CLAUDE_ACP_ENTRY"],
        }),
      );
    } else {
      const env = { ...process.env };
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;
      delete env.CLAUDE_CODE_SSE_PORT;
      results.push(
        summarize(
          await runBackend({
            label: "claude-http",
            cmd: process.execPath,
            args: [entry],
            env,
            mcpServers: httpServers,
          }),
        ),
      );
    }
  }

  httpHello.kill();

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
  }
  console.log("\nPaste this summary into research/peer-agent-mcp.md");
  process.exit(results.some((r) => r.sessionNew === "FAIL") ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
